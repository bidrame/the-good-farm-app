import { useState } from 'react'
import { NouvelleFiche } from '../composants/NouvelleFiche'
import { Link } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { soldesClients } from '../../lib/calculs/credits'
import { cleNom } from '../../lib/calculs/doublons'
import { formatFCFA } from '../../lib/format'
import { EtatVide, Titre } from '../composants/Pastille'

export function Clients() {
  const { clients, transactions, paiements } = useDonnees()
  const [recherche, setRecherche] = useState('')
  const soldes = soldesClients(clients, transactions, paiements)
  const totalDu = soldes.filter((s) => s.solde > 0).reduce((t, s) => t + s.solde, 0)
  const cle = cleNom(recherche)
  const trouves = cle.length >= 2 ? clients.filter((c) => !c.supprime_le && cleNom(c.nom).includes(cle)).slice(0, 20) : []

  return (
    <main>
      <Titre genre="client">Clients et crédits</Titre>
      <NouvelleFiche genre="client" />
      <div className="metrique" style={{ marginBottom: 12 }}>
        <div className="discret">Total à encaisser</div>
        <div className="valeur" data-testid="total-du">{formatFCFA(totalDu)}</div>
      </div>

      <section aria-label="Soldes" className="carte">
        {soldes.length === 0 && <EtatVide genre="credit" message="Aucun crédit en cours : tout le monde a payé." />}
        {soldes.map(({ client, solde }) => (
          <Link key={client.id} to={`/clients/${client.id}`} className="ligne" style={{ color: 'inherit', textDecoration: 'none' }}>
            <span>{client.nom}</span>
            <strong className={solde > 0 ? 'du' : 'entree'}>{solde > 0 ? formatFCFA(solde) : `Avance de ${formatFCFA(-solde)}`}</strong>
          </Link>
        ))}
      </section>

      <h2>Tous les clients</h2>
      <label>
        Rechercher
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="2 lettres minimum" />
      </label>
      {trouves.length > 0 && (
        <div className="carte">
          {trouves.map((c) => (
            <Link key={c.id} to={`/clients/${c.id}`} className="ligne" style={{ color: 'inherit' }}>{c.nom}</Link>
          ))}
        </div>
      )}
    </main>
  )
}
