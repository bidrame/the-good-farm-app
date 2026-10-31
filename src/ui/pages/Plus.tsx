import { IconChevronRight } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { Pastille } from '../composants/Pastille'
import type { Genre } from '../icones'

const LIENS: [string, Genre, string, string][] = [
  ['/clients', 'client', 'Clients et crédits', 'Qui doit combien, paiements, rappels'],
  ['/fournisseurs', 'fournisseur', 'Fournisseurs et dettes', 'Ce qu’il reste à payer, depuis quand'],
  ['/rapports', 'rapports', 'Rapports', 'Bilans, produits, clients, dépenses'],
  ['/historique', 'historique', 'Historique', 'Toutes les saisies, modifier ou supprimer'],
  ['/corbeille', 'corbeille', 'Corbeille', 'Restaurer une saisie supprimée'],
  ['/export', 'export', 'Export Excel', 'Sauvegarde et partage'],
  ['/reglages', 'reglages', 'Réglages', 'Produits, ouvriers, courbe de ponte'],
]

export function Plus() {
  return (
    <main>
      <h1>Plus</h1>
      {LIENS.map(([vers, genre, titre, detail]) => (
        <Link key={vers} to={vers} className="carte lien-carte">
          <Pastille genre={genre} />
          <span>
            <strong>{titre}</strong>
            <span className="discret" style={{ display: 'block' }}>{detail}</span>
          </span>
          <IconChevronRight className="chevron" size={20} aria-hidden="true" />
        </Link>
      ))}
    </main>
  )
}
