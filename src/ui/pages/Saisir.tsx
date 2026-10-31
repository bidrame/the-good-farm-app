import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { dernierPrix, validerTransaction } from '../../lib/calculs/credits'
import { estDoublonTransaction } from '../../lib/calculs/doublons'
import { CONDITIONNEMENTS_DEFAUT, OEUFS_PAR_PLATEAU, estProduitOeufs } from '../../lib/calculs/oeufs'
import { aujourdhui, formatDate, formatFCFA } from '../../lib/format'
import type { Transaction, TypeTx, Unite } from '../../lib/types'
import { vibrer } from '../composants/animations'
import { BoutonsProduits } from '../composants/BoutonsProduits'
import { ChampClient } from '../composants/ChampClient'
import { ChampMontant, Confirmation } from '../composants/communs'
import { Recapitulatif, Reussite } from '../composants/Recapitulatif'
import { useBrouillon } from '../useBrouillon'

type Paye = 'tout' | 'partie' | 'rien'

type Formulaire = {
  id: string
  type: TypeTx
  date: string
  client_id: string | null
  produit_id: string | null
  quantite: number | null
  prix_unitaire: number | null
  oeufs_par_unite: number
  paye: Paye
  montant_paye: number | null
  observation: string
}

const vide = (type: TypeTx = 'vente'): Formulaire => ({
  id: crypto.randomUUID(), type, date: aujourdhui(), client_id: null, produit_id: null, quantite: null, prix_unitaire: null,
  oeufs_par_unite: OEUFS_PAR_PLATEAU, paye: 'tout', montant_paye: null, observation: '',
})

/** Un brouillon est « commencé » dès qu'un client, un produit, une quantité ou un prix y figure. */
const commence = (b: Formulaire) => !!(b.client_id || b.produit_id || b.quantite || b.prix_unitaire)

const UNITE: Record<Unite, string> = { plaque: 'plateau', unite: 'unité', kg: 'kg', forfait: 'forfait', autre: 'unité' }

export function Saisir() {
  const { clients, produits, transactions, reglages, enregistrer } = useDonnees()
  const [params] = useSearchParams()
  const typeDemande: TypeTx = params.get('type') === 'depense' ? 'depense' : 'vente'
  const [f, setF, effacer] = useBrouillon<Formulaire>('brouillon-saisie', () => vide(typeDemande), (b) => ({
    ...b,
    id: b.id ?? crypto.randomUUID(),
    oeufs_par_unite: b.oeufs_par_unite ?? OEUFS_PAR_PLATEAU,
    type: commence(b) ? b.type : typeDemande,
    date: commence(b) ? b.date : aujourdhui(),
  }))
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [doublon, setDoublon] = useState(false)
  const [etape, setEtape] = useState<'formulaire' | 'recap' | 'fait'>('formulaire')
  const [enCours, setEnCours] = useState(false)

  const conditionnements = reglages[0]?.conditionnements?.length ? reglages[0].conditionnements : CONDITIONNEMENTS_DEFAUT
  const maj = (p: Partial<Formulaire>) => setF((x) => ({ ...x, ...p }))
  const produit = produits.find((p) => p.id === f.produit_id)
  const oeufs = f.type === 'vente' && estProduitOeufs(produit)
  const cond = conditionnements.find((c) => c.oeufs === f.oeufs_par_unite) ?? { nom: `Lot de ${f.oeufs_par_unite}`, oeufs: f.oeufs_par_unite }
  const montant = (f.quantite ?? 0) * (f.prix_unitaire ?? 0)
  const montantPaye = f.type === 'depense' ? 0 : f.paye === 'tout' ? montant : f.paye === 'rien' ? 0 : f.montant_paye ?? 0

  function prixPropose(clientId: string | null, produitId: string | null, taille: number) {
    if (!produitId) return null
    const pourOeufs = estProduitOeufs(produits.find((p) => p.id === produitId)) ? taille : undefined
    return dernierPrix(transactions, clientId, produitId, pourOeufs) ?? dernierPrixProduit(produitId, pourOeufs)
  }
  function dernierPrixProduit(produitId: string, taille?: number) {
    return transactions
      .filter((t) => t.produit_id === produitId && !t.supprime_le && (taille == null || (t.oeufs_par_unite ?? OEUFS_PAR_PLATEAU) === taille))
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.prix_unitaire ?? null
  }

  const choisirClient = (id: string | null) =>
    maj({ client_id: id, ...(f.produit_id && id ? { prix_unitaire: prixPropose(id, f.produit_id, f.oeufs_par_unite) } : {}) })
  const choisirProduit = (id: string) => maj({ produit_id: id, prix_unitaire: id ? prixPropose(f.client_id, id, f.oeufs_par_unite) : null })
  const choisirConditionnement = (taille: number) =>
    maj({ oeufs_par_unite: taille, prix_unitaire: prixPropose(f.client_id, f.produit_id, taille) })

  async function ajouterClient(nom: string) {
    const id = crypto.randomUUID()
    await enregistrer('clients', { id, nom })
    choisirClient(id)
  }

  function construire(): Transaction {
    return {
      id: f.id, date: f.date, type: f.type, client_id: f.client_id, produit_id: f.produit_id ?? '',
      prix_unitaire: f.prix_unitaire ?? 0, quantite: f.quantite ?? 0, montant, montant_paye: montantPaye,
      oeufs_par_unite: oeufs ? f.oeufs_par_unite : null, observation: f.observation.trim() || null,
    }
  }

  function continuer(forcer = false) {
    const t = construire()
    const e = validerTransaction(t, aujourdhui())
    setErreurs(e)
    if (Object.keys(e).length > 0) return
    if (!forcer && estDoublonTransaction(t, transactions)) return setDoublon(true)
    setDoublon(false)
    setEtape('recap')
  }

  async function valider() {
    if (enCours) return
    setEnCours(true)
    try {
      await enregistrer('transactions', { ...construire() })
      vibrer()
      setEtape('fait')
    } finally {
      setEnCours(false)
    }
  }

  if (etape === 'fait')
    return (
      <main>
        <Reussite
          message={f.type === 'vente' ? 'Vente enregistrée' : 'Dépense enregistrée'}
          detail={`${formatFCFA(montant)}${f.type === 'vente' && montantPaye < montant ? ` · reste ${formatFCFA(montant - montantPaye)} à encaisser` : ''}`}
          action="Nouvelle saisie"
          onAction={() => { effacer(); setEtape('formulaire'); setErreurs({}) }}
        />
      </main>
    )

  const nomClient = clients.find((c) => c.id === f.client_id)?.nom
  if (etape === 'recap')
    return (
      <main>
        <Recapitulatif
          titre={f.type === 'vente' ? 'Vérifiez la vente' : 'Vérifiez la dépense'}
          lignes={[
            ['Date', formatDate(f.date)],
            ...(nomClient ? [[f.type === 'vente' ? 'Client' : 'Fournisseur', nomClient] as [string, string]] : []),
            ['Produit', produit?.nom ?? ''],
            ['Quantité', oeufs ? `${f.quantite} × ${cond.nom}` : `${f.quantite} × ${formatFCFA(f.prix_unitaire ?? 0)}`],
            ...(oeufs ? [['Œufs', `${(f.quantite ?? 0) * cond.oeufs} œufs`] as [string, string], ['Prix', `${formatFCFA(f.prix_unitaire ?? 0)} / ${cond.nom.toLowerCase()}`] as [string, string]] : []),
            ...(f.type === 'vente' ? [['Paiement', f.paye === 'tout' ? 'Payé' : f.paye === 'rien' ? 'À crédit' : `${formatFCFA(montantPaye)} payés, reste ${formatFCFA(montant - montantPaye)}`] as [string, string]] : []),
            ...(f.observation.trim() ? [['Observation', f.observation.trim()] as [string, string]] : []),
          ]}
          total={['Montant', formatFCFA(montant)]}
          onModifier={() => setEtape('formulaire')}
          onValider={valider}
          enCours={enCours}
        />
      </main>
    )

  const unite = produit ? UNITE[produit.unite] : 'unité'

  return (
    <main>
      <div className="grille2" style={{ marginBottom: 14 }}>
        {(['vente', 'depense'] as const).map((t) => (
          <button key={t} type="button" className={f.type === t ? 'choisi' : ''} onClick={() => { setF(vide(t)); setErreurs({}) }}>
            {t === 'vente' ? 'Vente' : 'Dépense'}
          </button>
        ))}
      </div>

      <label>
        Date
        <input type="date" value={f.date} max={aujourdhui()} onChange={(e) => maj({ date: e.target.value })} />
        {erreurs.date && <div className="erreur">{erreurs.date}</div>}
      </label>

      <ChampClient
        libelle={f.type === 'vente' ? 'Client' : 'Fournisseur (facultatif)'}
        clients={clients}
        valeur={f.client_id}
        onChange={choisirClient}
        onAjouter={ajouterClient}
        erreur={erreurs.client_id}
      />

      <BoutonsProduits produits={produits} transactions={transactions} type={f.type} valeur={f.produit_id} onChange={choisirProduit} erreur={erreurs.produit_id} />

      {oeufs && (
        <div role="group" aria-label="Conditionnement" style={{ marginBottom: 10 }}>
          <span className="discret">Vendu en</span>
          <div className="puces" style={{ marginTop: 5 }}>
            {conditionnements.map((c) => (
              <button key={c.oeufs} type="button" className={c.oeufs === f.oeufs_par_unite ? 'choisi' : ''} onClick={() => choisirConditionnement(c.oeufs)}>{c.nom}</button>
            ))}
          </div>
        </div>
      )}

      <div className="grille2">
        <ChampMontant libelle="Quantité" valeur={f.quantite} onChange={(n) => maj({ quantite: n })} erreur={erreurs.quantite} />
        <ChampMontant libelle={`Prix / ${oeufs ? cond.nom.toLowerCase() : unite}`} valeur={f.prix_unitaire} onChange={(n) => maj({ prix_unitaire: n })} erreur={erreurs.prix_unitaire} />
      </div>
      {oeufs && !!f.quantite && <div className="discret" style={{ marginTop: -4, marginBottom: 6 }}>= {f.quantite * cond.oeufs} œufs</div>}

      <div className="ligne" style={{ fontWeight: 800, fontSize: 18 }}>
        <span>Montant</span>
        <span data-testid="montant">{formatFCFA(montant)}</span>
      </div>

      {f.type === 'vente' && (
        <>
          <span className="discret">Payé</span>
          <div className="grille3" style={{ margin: '5px 0 10px' }}>
            {([['tout', 'Tout'], ['partie', 'Une partie'], ['rien', 'Rien (crédit)']] as const).map(([v, l]) => (
              <button key={v} type="button" className={f.paye === v ? 'choisi' : ''} onClick={() => maj({ paye: v })}>{l}</button>
            ))}
          </div>
          {f.paye === 'partie' && (
            <>
              <ChampMontant libelle="Montant payé" valeur={f.montant_paye} onChange={(n) => maj({ montant_paye: n })} erreur={erreurs.montant_paye} />
              <div className="discret" data-testid="reste">reste {formatFCFA(Math.max(0, montant - (f.montant_paye ?? 0)))}</div>
            </>
          )}
          {f.paye !== 'partie' && erreurs.montant_paye && <div className="erreur">{erreurs.montant_paye}</div>}
        </>
      )}

      <label>
        Observation (facultatif)
        <textarea rows={2} value={f.observation} onChange={(e) => maj({ observation: e.target.value })} />
      </label>

      <button className="principal" onClick={() => continuer()}>Continuer</button>

      {doublon && (
        <Confirmation
          message="Déjà saisi ? Une vente identique (même client, produit, montant et jour) existe déjà."
          oui="Continuer quand même"
          onOui={() => continuer(true)}
          onNon={() => setDoublon(false)}
        />
      )}
    </main>
  )
}
