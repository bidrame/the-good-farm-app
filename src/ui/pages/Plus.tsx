import { IconChevronRight } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { Pastille } from '../composants/Pastille'
import type { Genre } from '../icones'

type Lien = [string, Genre, string, string]

/** Trois rubriques plutôt qu'une longue liste : on retrouve une page par ce qu'elle concerne. */
export const RUBRIQUES: [string, Lien[]][] = [
  ['La ferme', [
    ['/bandes', 'bande', 'Bandes', 'Effectifs, âge, réforme'],
    ['/stock', 'stock', 'Stock d’œufs', 'Le magasin jour par jour, par box et calibre'],
    ['/aliment', 'aliment', 'Aliment', 'Stock de sacs, consommation, alerte avant rupture'],
  ]],
  ['L’argent', [
    ['/clients', 'client', 'Clients et crédits', 'Qui doit combien, paiements, rappels'],
    ['/fournisseurs', 'fournisseur', 'Fournisseurs et dettes', 'Ce qu’il reste à payer, depuis quand'],
    ['/couts', 'couts', 'Prix de revient', 'Ce que coûte un plateau, marge par mois'],
    ['/rapports', 'rapports', 'Rapports', 'Bilans, produits, clients, dépenses'],
  ]],
  ['Outils', [
    ['/historique', 'historique', 'Historique', 'Toutes les saisies, pour corriger ou supprimer'],
    ['/corbeille', 'corbeille', 'Corbeille', 'Restaurer une saisie supprimée'],
    ['/export', 'export', 'Export Excel', 'Sauvegarde et partage'],
    ['/reglages', 'reglages', 'Réglages', 'Boxes, produits, ouvriers, courbe de ponte'],
  ]],
]

export function Plus() {
  return (
    <main>
      <h1>Plus</h1>
      {RUBRIQUES.map(([rubrique, liens]) => (
        <section key={rubrique} aria-label={rubrique}>
          <h2>{rubrique}</h2>
          {liens.map(([vers, genre, titre, detail]) => (
            <Link key={vers} to={vers} className="carte lien-carte">
              <Pastille genre={genre} />
              <span>
                <strong>{titre}</strong>
                <span className="discret" style={{ display: 'block' }}>{detail}</span>
              </span>
              <IconChevronRight className="chevron" size={20} aria-hidden="true" />
            </Link>
          ))}
        </section>
      ))}
    </main>
  )
}
