import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { soldeClient } from '../../lib/calculs/credits'
import { aujourdhui, formatDate, formatFCFA } from '../../lib/format'
import type { ModePaiement } from '../../lib/types'
import { lienRappel } from '../../lib/whatsapp'
import { vibrer } from '../composants/animations'
import { ChampMontant } from '../composants/communs'
import { Recapitulatif, Reussite } from '../composants/Recapitulatif'
import { Titre } from '../composants/Pastille'

export const MODES: [ModePaiement, string][] = [
  ['especes', 'Espèces'], ['wave', 'Wave'], ['orange_money', 'Orange Money'], ['virement', 'Virement'], ['autre', 'Autre'],
]

const NB_HISTORIQUE = 30

/** Paiement reçu d'un client (par défaut) ou versé à un fournisseur. */
export function FormulairePaiement({ clientId, soldeActuel, onFini, sens = 'client' }: { clientId: string; soldeActuel: number; onFini: () => void; sens?: 'client' | 'fournisseur' }) {
  const { enregistrer } = useDonnees()
  const [montant, setMontant] = useState<number | null>(null)
  const [mode, setMode] = useState<ModePaiement>('especes')
  const [date, setDate] = useState(aujourdhui())
  const [erreur, setErreur] = useState<string | null>(null)
  const [etape, setEtape] = useState<'formulaire' | 'recap' | 'fait'>('formulaire')
  const [enCours, setEnCours] = useState(false)
  const [id] = useState(() => crypto.randomUUID())
  const nouveauSolde = soldeActuel - (montant ?? 0)

  async function valider() {
    if (enCours) return
    setEnCours(true)
    try {
      await enregistrer('paiements', { id, client_id: clientId, montant, mode, date, sens })
      vibrer()
      setEtape('fait')
    } finally {
      setEnCours(false)
    }
  }

  if (etape === 'fait')
    return <Reussite message="Paiement enregistré" detail={`${formatFCFA(montant ?? 0)} ${sens === 'client' ? 'reçus' : 'versés'}`} action="Fermer" onAction={onFini} />

  if (etape === 'recap')
    return (
      <Recapitulatif
        titre="Vérifiez le paiement"
        lignes={[
          ['Date', formatDate(date)],
          ['Mode', MODES.find((m) => m[0] === mode)?.[1] ?? mode],
          [sens === 'client' ? 'Nouveau solde' : 'Reste à payer', nouveauSolde >= 0 ? formatFCFA(nouveauSolde) : `Avance de ${formatFCFA(-nouveauSolde)}`],
        ]}
        total={[sens === 'client' ? 'Montant reçu' : 'Montant versé', formatFCFA(montant ?? 0)]}
        onModifier={() => setEtape('formulaire')}
        onValider={valider}
        enCours={enCours}
      />
    )

  return (
    <div className="carte">
      <ChampMontant libelle="Montant" valeur={montant} onChange={(v) => { setMontant(v); setErreur(null) }} erreur={erreur ?? undefined} />
      <label>
        Mode
        <select value={mode} onChange={(e) => setMode(e.target.value as ModePaiement)}>
          {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>Date<input type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} /></label>
      <button className="principal" onClick={() => {
        if (!montant || montant <= 0) return setErreur('Montant obligatoire')
        setEtape('recap')
      }}>Continuer</button>
    </div>
  )
}

export function ClientFiche() {
  const { id } = useParams()
  const { clients, transactions, paiements, produits, enregistrer } = useDonnees()
  const [paiement, setPaiement] = useState(false)
  const c = clients.find((x) => x.id === id)
  if (!c) return <main><p>Client introuvable.</p><Link to="/clients">Retour</Link></main>

  const solde = soldeClient(c.id, transactions, paiements)
  const ventes = transactions.filter((t) => t.client_id === c.id && t.type === 'vente' && !t.supprime_le)
  const ca = ventes.reduce((s, t) => s + t.montant, 0)
  const nomProduit = (pid: string) => produits.find((p) => p.id === pid)?.nom ?? '?'
  const historique = [
    ...ventes.map((t) => ({ id: t.id, date: t.date, libelle: `${nomProduit(t.produit_id)} × ${t.quantite}`, montant: t.montant, reste: t.montant - t.montant_paye })),
    ...paiements.filter((p) => p.client_id === c.id && !p.supprime_le).map((p) => ({ id: p.id, date: p.date, libelle: `Paiement (${MODES.find((m) => m[0] === p.mode)?.[1]})`, montant: -p.montant, reste: 0 })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, NB_HISTORIQUE)

  return (
    <main>
      <Link to="/clients" className="discret">← Clients</Link>
      <Titre genre="client">{c.nom}</Titre>
      <div className="grille2" style={{ marginBottom: 10 }}>
        <div className="metrique"><div className="discret">Solde</div><div className={`valeur ${solde > 0 ? 'mauvais' : 'ok'}`} data-testid="solde">{solde >= 0 ? formatFCFA(solde) : `Avance ${formatFCFA(-solde)}`}</div></div>
        <div className="metrique"><div className="discret">Chiffre d’affaires</div><div className="valeur">{formatFCFA(ca)}</div></div>
      </div>

      <button onClick={() => setPaiement((p) => !p)} style={{ width: '100%', marginBottom: 8 }}>Enregistrer un paiement</button>
      {paiement && <FormulairePaiement clientId={c.id} soldeActuel={solde} onFini={() => setPaiement(false)} />}
      {solde > 0 && (
        <a className="carte" style={{ display: 'block', textAlign: 'center', color: 'var(--vert)', fontWeight: 600 }} href={lienRappel(c.nom, solde, c.telephone)} target="_blank" rel="noreferrer">
          Rappel WhatsApp
        </a>
      )}

      <label>
        Téléphone
        <input inputMode="tel" defaultValue={c.telephone ?? ''} onBlur={(e) => e.target.value !== (c.telephone ?? '') && enregistrer('clients', { ...c, telephone: e.target.value.trim() || null })} />
      </label>

      <h2>Historique</h2>
      <div className="carte">
        {historique.length === 0 && <p className="discret">Aucune opération.</p>}
        {historique.map((h) => (
          <div className="ligne" key={h.id}>
            <span><span className="discret">{formatDate(h.date)}</span> {h.libelle}</span>
            <span className={h.montant < 0 ? 'ok' : ''}>
              {formatFCFA(Math.abs(h.montant))}{h.reste > 0 && <span className="mauvais"> (reste {formatFCFA(h.reste)})</span>}
            </span>
          </div>
        ))}
      </div>
    </main>
  )
}
