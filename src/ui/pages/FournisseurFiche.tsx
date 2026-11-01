import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { detteFournisseur } from '../../lib/calculs/dettes'
import { aujourdhui, formatDate, formatFCFA } from '../../lib/format'
import { FormulairePaiement, MODES } from './ClientFiche'
import { depuisJours } from './Fournisseurs'
import { Titre } from '../composants/Pastille'
import { TelephoneFiche } from '../composants/ChampTelephone'

const NB_HISTORIQUE = 30

export function FournisseurFiche() {
  const { id } = useParams()
  const { clients, transactions, paiements, produits } = useDonnees()
  const [paiement, setPaiement] = useState(false)
  const f = clients.find((x) => x.id === id)
  if (!f) return <main><p>Fournisseur introuvable.</p><Link to="/fournisseurs">Retour</Link></main>

  const dette = detteFournisseur(f.id, transactions, paiements, aujourdhui())
  const achats = transactions.filter((t) => t.client_id === f.id && t.type === 'depense' && !t.supprime_le)
  const nomProduit = (pid: string) => produits.find((p) => p.id === pid)?.nom ?? '?'
  const historique = [
    ...achats.map((t) => ({ id: t.id, date: t.date, libelle: `${nomProduit(t.produit_id)} × ${t.quantite}`, montant: t.montant, reste: t.montant - t.montant_paye })),
    ...paiements.filter((p) => p.client_id === f.id && p.sens === 'fournisseur' && !p.supprime_le).map((p) => ({
      id: p.id, date: p.date, libelle: `Paiement (${MODES.find((m) => m[0] === p.mode)?.[1]})`, montant: -p.montant, reste: 0,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, NB_HISTORIQUE)

  return (
    <main>
      <Titre genre="fournisseur">{f.nom}</Titre>
      <div className="grille2" style={{ marginBottom: 10 }}>
        <div className="metrique">
          <div className="discret">Reste à payer</div>
          <div className={`valeur ${dette.du > 0 ? 'mauvais' : 'ok'}`} data-testid="du">{formatFCFA(dette.du)}</div>
          {dette.jours != null && <div className="discret">{depuisJours(dette.jours)}</div>}
        </div>
        <div className="metrique"><div className="discret">Total des achats</div><div className="valeur">{formatFCFA(achats.reduce((s, t) => s + t.montant, 0))}</div></div>
      </div>

      <button onClick={() => setPaiement((p) => !p)} style={{ width: '100%', marginBottom: 8 }}>Enregistrer un paiement</button>
      {paiement && <FormulairePaiement clientId={f.id} sens="fournisseur" soldeActuel={dette.du} onFini={() => setPaiement(false)} />}

      <TelephoneFiche key={f.id} c={f} />

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
