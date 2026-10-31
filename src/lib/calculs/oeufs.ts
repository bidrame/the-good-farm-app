import type { Conditionnement, Ponte, Produit, StockDepart, Transaction } from '../types'

export const OEUFS_PAR_PLATEAU = 30

export const CONDITIONNEMENTS_DEFAUT: Conditionnement[] = [
  { nom: 'Plateau de 30', oeufs: 30 },
  { nom: 'Carton de 12 plateaux', oeufs: 360 },
  { nom: 'Boîte de 12', oeufs: 12 },
  { nom: 'Boîte de 6', oeufs: 6 },
  { nom: 'À l’unité', oeufs: 1 },
]

export function enOeufs(lots: number, taille: number, restants = 0): number {
  return lots * taille + restants
}

export function decomposer(oeufs: number, taille: number): { lots: number; restants: number } {
  return { lots: Math.floor(oeufs / taille), restants: oeufs % taille }
}

/** Un produit se vend en œufs quand son unité est la plaque (plateau). */
export const estProduitOeufs = (p: Produit | undefined) => p?.unite === 'plaque'

export function oeufsVendus(t: Transaction, produits: Produit[]): number {
  if (t.supprime_le || t.type !== 'vente') return 0
  if (!estProduitOeufs(produits.find((p) => p.id === t.produit_id))) return 0
  return t.quantite * (t.oeufs_par_unite ?? OEUFS_PAR_PLATEAU)
}

/** Stock = inventaire de départ + ponte (moins les pertes) − ventes, pour les jours suivant l'inventaire. */
export function stockOeufs({ pontes, transactions, produits, depart }: {
  pontes: Ponte[]; transactions: Transaction[]; produits: Produit[]; depart: StockDepart
}): number {
  const ramasses = pontes
    .filter((p) => !p.supprime_le && p.date > depart.date)
    .reduce((s, p) => s + p.oeufs_collectes - p.oeufs_perdus, 0)
  const vendus = transactions.filter((t) => t.date > depart.date).reduce((s, t) => s + oeufsVendus(t, produits), 0)
  return depart.oeufs + ramasses - vendus
}

export function statsVentesOeufs(transactions: Transaction[], produits: Produit[]) {
  const ventes = transactions.filter((t) => oeufsVendus(t, produits) > 0)
  const oeufs = ventes.reduce((s, t) => s + oeufsVendus(t, produits), 0)
  const montant = ventes.reduce((s, t) => s + t.montant, 0)
  const plateaux = oeufs / OEUFS_PAR_PLATEAU
  return { oeufs, plateaux, montant, prixMoyenPlateau: plateaux > 0 ? Math.round(montant / plateaux) : null }
}
