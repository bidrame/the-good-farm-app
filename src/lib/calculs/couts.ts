import { ajouterJours } from '../format'
import type { Ponte, Produit, Transaction } from '../types'
import { OEUFS_PAR_PLATEAU, oeufsVendus } from './oeufs'

/** Dépenses qui ne servent pas les pondeuses : poulets de chair, moutons, déplumeuse, achats d'œufs, gros équipement. */
const HORS_OEUFS = /chair|mouton|d[ée]plum|[ée]quipement|^\s*(œ|oe)ufs\s*$/i

/** Produits de dépense exclus du prix de revient : le réglage s'il existe, sinon ceux reconnus par leur nom. */
export function produitsExclus(produits: Produit[], reglage?: string[] | null): string[] {
  if (reglage) return reglage
  return produits.filter((p) => p.type === 'depense' && HORS_OEUFS.test(p.nom)).map((p) => p.id)
}

export interface PosteCout { produit: Produit; montant: number; parPlateau: number }

export interface MoisCout {
  mois: string
  depenses: number
  postes: PosteCout[]
  /** Plateaux produits (ponte saisie chaque jour du mois) ou, à défaut, plateaux vendus. */
  plateaux: number
  base: 'ponte' | 'ventes'
  coutPlateau: number | null
  prixVente: number | null
  marge: number | null
}

const joursDuMois = (mois: string) => new Date(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 0).getDate()

/** La ponte compte si elle est saisie presque tous les jours du mois (jusqu'à hier pour le mois en cours). */
function ponteComplete(pontes: Ponte[], mois: string, aujourdhui: string): boolean {
  const dernier = mois === aujourdhui.slice(0, 7) ? Number(ajouterJours(aujourdhui, -1).slice(8)) : joursDuMois(mois)
  if (dernier < 1) return false
  const jours = new Set(pontes.filter((p) => p.date.startsWith(mois) && p.oeufs_collectes > 0).map((p) => p.date))
  return jours.size >= dernier - 2
}

/** Prix de revient d'un plateau, mois par mois (du plus récent au plus ancien). */
export function prixDeRevient(
  { transactions, pontes, produits, exclus }: { transactions: Transaction[]; pontes: Ponte[]; produits: Produit[]; exclus: string[] },
  aujourdhui: string,
  nbMois = 6,
): MoisCout[] {
  const txs = transactions.filter((t) => !t.supprime_le)
  const ponteVivante = pontes.filter((p) => !p.supprime_le)
  const mois: string[] = []
  for (let d = new Date(Number(aujourdhui.slice(0, 4)), Number(aujourdhui.slice(5, 7)) - 1, 1), i = 0; i < nbMois; i++, d.setMonth(d.getMonth() - 1))
    mois.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)

  return mois.map((m) => {
    const duMois = txs.filter((t) => t.date.startsWith(m))
    const parProduit = new Map<string, number>()
    for (const t of duMois) if (t.type === 'depense' && !exclus.includes(t.produit_id)) parProduit.set(t.produit_id, (parProduit.get(t.produit_id) ?? 0) + t.montant)
    const depenses = [...parProduit.values()].reduce((s, n) => s + n, 0)

    const ventesOeufs = duMois.filter((t) => oeufsVendus(t, produits) > 0)
    const plateauxVendus = ventesOeufs.reduce((s, t) => s + oeufsVendus(t, produits), 0) / OEUFS_PAR_PLATEAU
    const parPonte = ponteComplete(ponteVivante, m, aujourdhui)
    const plateaux = parPonte
      ? ponteVivante.filter((p) => p.date.startsWith(m)).reduce((s, p) => s + p.oeufs_collectes - p.oeufs_perdus, 0) / OEUFS_PAR_PLATEAU
      : plateauxVendus

    const coutPlateau = plateaux > 0 && depenses > 0 ? Math.round(depenses / plateaux) : null
    const prixVente = plateauxVendus > 0 ? Math.round(ventesOeufs.reduce((s, t) => s + t.montant, 0) / plateauxVendus) : null
    return {
      mois: m, depenses, plateaux: Math.round(plateaux), base: parPonte ? 'ponte' : 'ventes',
      postes: [...parProduit.entries()]
        .map(([id, montant]) => ({ produit: produits.find((p) => p.id === id) ?? { id, nom: '?', type: 'depense', unite: 'unite', actif: true }, montant, parPlateau: plateaux > 0 ? Math.round(montant / plateaux) : 0 }))
        .sort((a, b) => b.montant - a.montant),
      coutPlateau, prixVente,
      marge: coutPlateau != null && prixVente != null ? prixVente - coutPlateau : null,
    }
  })
}

/** Moyenne sur plusieurs mois, pondérée par les plateaux : lisse les gros achats (poussins, réparations). */
export function moyenneCouts(liste: MoisCout[]): { coutPlateau: number; prixVente: number | null; marge: number | null } | null {
  const avec = liste.filter((m) => m.plateaux > 0)
  const plateaux = avec.reduce((s, m) => s + m.plateaux, 0)
  if (!plateaux) return null
  const coutPlateau = Math.round(avec.reduce((s, m) => s + m.depenses, 0) / plateaux)
  const vendus = avec.filter((m) => m.prixVente != null)
  const poids = vendus.reduce((s, m) => s + m.plateaux, 0)
  const prixVente = poids ? Math.round(vendus.reduce((s, m) => s + (m.prixVente ?? 0) * m.plateaux, 0) / poids) : null
  return { coutPlateau, prixVente, marge: prixVente != null ? prixVente - coutPlateau : null }
}
