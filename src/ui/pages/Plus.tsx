import { Link } from 'react-router-dom'

const LIENS: [string, string, string][] = [
  ['/clients', 'Clients et crédits', 'Qui doit combien, paiements, rappels'],
  ['/rapports', 'Rapports', 'Bilans, produits, clients, dépenses'],
  ['/historique', 'Historique', 'Toutes les saisies, modifier ou supprimer'],
  ['/corbeille', 'Corbeille', 'Restaurer une saisie supprimée'],
  ['/export', 'Export Excel', 'Sauvegarde et partage'],
  ['/reglages', 'Réglages', 'Produits, ouvriers, courbe de ponte'],
]

export function Plus() {
  return (
    <main>
      <h1>Plus</h1>
      {LIENS.map(([vers, titre, detail]) => (
        <Link key={vers} to={vers} className="carte" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          <strong>{titre}</strong>
          <div className="discret">{detail}</div>
        </Link>
      ))}
    </main>
  )
}
