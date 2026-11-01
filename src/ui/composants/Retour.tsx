import { Link, useLocation } from 'react-router-dom'
import { RUBRIQUES } from '../pages/Plus'

/** Pages rangées dans « Plus » (et leurs fiches) : l'onglet Plus reste allumé quand on y est. */
const PAGES_PLUS = RUBRIQUES.flatMap(([, liens]) => liens.map(([vers]) => vers))

export const estDansPlus = (chemin: string) => PAGES_PLUS.some((p) => chemin === p || chemin.startsWith(`${p}/`))

/** Page parente : la liste pour une fiche, « Plus » pour une page du menu, l'accueil pour les alertes. */
function parente(chemin: string): [string, string] | null {
  const fiche = chemin.match(/^\/(clients|bandes|fournisseurs)\/.+/)
  if (fiche) return [`/${fiche[1]}`, { clients: 'Clients', bandes: 'Bandes', fournisseurs: 'Fournisseurs' }[fiche[1]]!]
  if (chemin === '/alertes') return ['/', 'Accueil']
  if (estDansPlus(chemin)) return ['/plus', 'Plus']
  return null
}

/** Bouton retour commun, en haut des pages qui ne sont pas des onglets. */
export function Retour() {
  const { pathname } = useLocation()
  const p = parente(pathname)
  if (!p) return null
  return (
    <div className="entete-retour">
      <Link to={p[0]} className="retour">← {p[1]}</Link>
    </div>
  )
}
