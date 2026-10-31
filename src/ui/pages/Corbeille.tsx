import { useDonnees } from '../../data/useDonnees'
import { ajouterJours, aujourdhui, formatDate } from '../../lib/format'
import { journal } from '../lignes'

const JOURS_CORBEILLE = 30

export function Corbeille() {
  const d = useDonnees()
  const limite = ajouterJours(aujourdhui(), -JOURS_CORBEILLE)
  const lignes = journal(d).filter((l) => l.supprime_le && l.supprime_le.slice(0, 10) >= limite)
  return (
    <main>
      <h1>Corbeille</h1>
      <p className="discret">Les saisies supprimées restent ici {JOURS_CORBEILLE} jours.</p>
      {lignes.length === 0 && <p className="discret">La corbeille est vide.</p>}
      {lignes.map((l) => (
        <article key={`${l.table}-${l.id}`} className="carte">
          <div className="ligne" style={{ padding: 0 }}>
            <strong>{l.titre}</strong>
            <span className="discret">{formatDate(l.date)}</span>
          </div>
          <div>{l.detail}</div>
          <button onClick={() => d.restaurer(l.table, l.id)}>Restaurer</button>
        </article>
      ))}
    </main>
  )
}
