import { ajouterJours, joursEntre } from '../format'
import type { DateISO, Ponte, Produit, ReglagesAliment, Transaction } from '../types'

export const KG_PAR_SAC = 50
export const JOURS_ALERTE_ALIMENT = 5
const JOURS_LIVRAISONS = 60
const JOURS_SAISIE = 7

/** Produits « aliment des pondeuses » : le réglage, sinon ceux nommés « aliment pondeuse ». */
export function produitsAliment(produits: Produit[], reglage?: ReglagesAliment | null): string[] {
  if (reglage?.produit_ids?.length) return reglage.produit_ids
  return produits.filter((p) => p.type === 'depense' && /aliment.*pond/i.test(p.nom)).map((p) => p.id)
}

/**
 * Sacs livrés par une dépense. La quantité saisie fait foi, sauf quand la ligne a été saisie « 1 × montant total » :
 * on retrouve alors le nombre de sacs avec le prix habituel du sac.
 */
export function sacsLivres(t: Transaction, prixHabituel: number | null): number {
  if (!prixHabituel || (t.prix_unitaire >= prixHabituel * 0.5 && t.prix_unitaire <= prixHabituel * 1.5)) return t.quantite
  return Math.round(t.montant / prixHabituel)
}

function mediane(l: number[]): number | null {
  if (!l.length) return null
  const s = [...l].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Prix habituel d'un sac : la médiane des 20 derniers achats (ignore les lignes « 1 × montant total »). */
export const prixHabituelSac = (achats: Transaction[]) =>
  mediane([...achats].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((t) => t.prix_unitaire))

export interface EtatAliment {
  /** Consommation de la ferme en kg par jour, et d'où elle vient. */
  kgParJour: number | null
  source: 'ponte' | 'livraisons' | null
  /** Stock restant (si un inventaire a été fait). */
  stockKg: number | null
  stockSacs: number | null
  jours: number | null
  livresDepuis: number
}

export function etatAliment(
  { transactions, pontes, produits, reglage }: { transactions: Transaction[]; pontes: Ponte[]; produits: Produit[]; reglage?: ReglagesAliment | null },
  aujourdhui: DateISO,
): EtatAliment {
  const kgSac = reglage?.kg_par_sac || KG_PAR_SAC
  const ids = produitsAliment(produits, reglage)
  const achats = transactions.filter((t) => !t.supprime_le && t.type === 'depense' && ids.includes(t.produit_id))
  const prixHabituel = prixHabituelSac(achats)
  const kgLivres = (du: DateISO, au: DateISO) =>
    achats.filter((t) => t.date > du && t.date <= au).reduce((s, t) => s + sacsLivres(t, prixHabituel), 0) * kgSac

  // Consommation : l'aliment noté avec la ponte s'il l'est presque tous les jours, sinon le rythme des livraisons.
  const hier = ajouterJours(aujourdhui, -1)
  const debutSaisie = ajouterJours(hier, -(JOURS_SAISIE - 1))
  const parJour = new Map<string, number>()
  for (const p of pontes) if (!p.supprime_le && p.aliment_kg && p.date >= debutSaisie && p.date <= hier) parJour.set(p.date, (parJour.get(p.date) ?? 0) + p.aliment_kg)
  let kgParJour: number | null = null
  let source: EtatAliment['source'] = null
  if (parJour.size >= JOURS_SAISIE - 2) {
    kgParJour = [...parJour.values()].reduce((s, n) => s + n, 0) / parJour.size
    source = 'ponte'
  } else {
    const livres = kgLivres(ajouterJours(aujourdhui, -JOURS_LIVRAISONS), aujourdhui)
    if (livres > 0) { kgParJour = livres / JOURS_LIVRAISONS; source = 'livraisons' }
  }

  const inv = reglage?.stock
  if (!inv) return { kgParJour, source, stockKg: null, stockSacs: null, jours: null, livresDepuis: 0 }
  // Après l'inventaire : livraisons ajoutées, consommation retirée (le jour noté s'il l'est, sinon le rythme moyen).
  const livresDepuis = kgLivres(inv.date, aujourdhui)
  let mange = 0
  for (let d = ajouterJours(inv.date, 1); d <= aujourdhui && joursEntre(inv.date, d) <= 366; d = ajouterJours(d, 1)) {
    const note = pontes.filter((p) => !p.supprime_le && p.date === d && p.aliment_kg).reduce((s, p) => s + (p.aliment_kg ?? 0), 0)
    mange += note > 0 ? note : d < aujourdhui ? kgParJour ?? 0 : 0
  }
  const stockKg = Math.max(0, inv.sacs * kgSac + livresDepuis - mange)
  return {
    kgParJour, source, stockKg: Math.round(stockKg), stockSacs: Math.round(stockKg / kgSac),
    jours: kgParJour ? Math.floor(stockKg / kgParJour) : null, livresDepuis: Math.round(livresDepuis / kgSac),
  }
}
