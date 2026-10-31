import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { cleNom } from '../../lib/calculs/doublons'
import { dettesFournisseurs } from '../../lib/calculs/dettes'
import { aujourdhui, formatFCFA } from '../../lib/format'
import { EtatVide, Titre } from '../composants/Pastille'

export const depuisJours = (jours: number | null) => (jours == null ? '' : jours === 0 ? 'depuis aujourd’hui' : `depuis ${jours} jour${jours > 1 ? 's' : ''}`)

export function Fournisseurs() {
  const { clients, transactions, paiements } = useDonnees()
  const [recherche, setRecherche] = useState('')
  const { lignes, total } = dettesFournisseurs(clients, transactions, paiements, aujourdhui())
  const cle = cleNom(recherche)
  const trouves = cle.length >= 2 ? clients.filter((c) => !c.supprime_le && cleNom(c.nom).includes(cle)).slice(0, 20) : []

  return (
    <main>
      <Titre genre="fournisseur">Fournisseurs et dettes</Titre>
      <div className="metrique" style={{ marginBottom: 12 }}>
        <div className="discret">Total à payer</div>
        <div className="valeur" data-testid="total-a-payer">{formatFCFA(total)}</div>
      </div>

      <section aria-label="Dettes" className="carte">
        {lignes.length === 0 && <EtatVide genre="aPayer" message="Aucune dette fournisseur. Bravo !" />}
        {lignes.map(({ fournisseur, du, jours }) => (
          <Link key={fournisseur.id} to={`/fournisseurs/${fournisseur.id}`} className="ligne" style={{ color: 'inherit', textDecoration: 'none' }}>
            <span>{fournisseur.nom}<span className="discret" style={{ display: 'block' }}>{depuisJours(jours)}</span></span>
            <strong className="du">{formatFCFA(du)}</strong>
          </Link>
        ))}
      </section>

      <h2>Tous les fournisseurs</h2>
      <label>
        Rechercher
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="2 lettres minimum" />
      </label>
      {trouves.length > 0 && (
        <div className="carte">
          {trouves.map((c) => <Link key={c.id} to={`/fournisseurs/${c.id}`} className="ligne" style={{ color: 'inherit' }}>{c.nom}</Link>)}
        </div>
      )}
    </main>
  )
}
