import type { Bande, BoxFerme, Calibre, Ponte, Produit, StockDepart, Transaction } from '../types'
import { oeufsVendus } from './oeufs'

/** Du plus gros au plus petit ; « null » regroupe les box et les œufs non classés. */
export const CALIBRES: Calibre[] = ['gros', 'moyen', 'petit']
export const NOM_CALIBRE: Record<Calibre, string> = { gros: 'Gros', moyen: 'Moyen', petit: 'Petit' }
export const nomCalibre = (c: Calibre | null | undefined) => (c ? NOM_CALIBRE[c] : 'Non classé')

export const calibreDuBox = (boxes: BoxFerme[], numero: number): Calibre | null => boxes.find((b) => b.numero === numero)?.calibre ?? null

/** Clé d'un calibre dans un tableau de totaux (les non classés sous « autre »). */
export type CleCalibre = Calibre | 'autre'
export const cle = (c: Calibre | null | undefined): CleCalibre => c ?? 'autre'
export const ORDRE_CLES: CleCalibre[] = ['gros', 'moyen', 'petit', 'autre']
export const depuisCle = (k: CleCalibre): Calibre | null => (k === 'autre' ? null : k)
export const nomCle = (k: CleCalibre) => nomCalibre(depuisCle(k))

/** Additionne des quantités par calibre. */
export function parCalibre<T>(liste: T[], calibre: (x: T) => Calibre | null | undefined, quantite: (x: T) => number): Partial<Record<CleCalibre, number>> {
  const t: Partial<Record<CleCalibre, number>> = {}
  for (const x of liste) t[cle(calibre(x))] = (t[cle(calibre(x))] ?? 0) + quantite(x)
  return t
}

/** Répartit `total` au prorata de `poids` (en entiers, le reste au plus gros poste). */
export function auProrata(total: number, poids: Partial<Record<CleCalibre, number>>): Partial<Record<CleCalibre, number>> {
  const cles = ORDRE_CLES.filter((k) => (poids[k] ?? 0) > 0)
  const somme = cles.reduce((s, k) => s + (poids[k] ?? 0), 0)
  if (!somme || !total) return {}
  const r: Partial<Record<CleCalibre, number>> = {}
  for (const k of cles) r[k] = Math.floor((total * (poids[k] ?? 0)) / somme)
  const ecart = total - cles.reduce((s, k) => s + (r[k] ?? 0), 0)
  const principal = cles.reduce((a, b) => ((poids[b] ?? 0) > (poids[a] ?? 0) ? b : a))
  r[principal] = (r[principal] ?? 0) + ecart
  return r
}

/**
 * Stock du magasin par calibre : inventaire + ponte (œufs cassés retirés) de chaque box selon son calibre
 * − ventes de chaque calibre. Les ventes sans calibre se prennent sur les non classés ; s'il n'y en a plus,
 * elles sont retirées des autres calibres au prorata, pour que le total reste juste.
 */
export function stockParCalibre({ pontes, transactions, produits, depart, bandes, boxes }: {
  pontes: Ponte[]; transactions: Transaction[]; produits: Produit[]; depart: StockDepart; bandes: Bande[]; boxes: BoxFerme[]
}): Partial<Record<CleCalibre, number>> {
  const s: Partial<Record<CleCalibre, number>> = {}
  const ajouter = (k: CleCalibre, n: number) => { s[k] = (s[k] ?? 0) + n }
  const comptes = depart.par_calibre ?? {}
  for (const c of CALIBRES) if (comptes[c]) ajouter(c, comptes[c]!)
  ajouter('autre', depart.oeufs - CALIBRES.reduce((t, c) => t + (comptes[c] ?? 0), 0))
  for (const p of pontes) {
    if (p.supprime_le || p.date <= depart.date) continue
    const box = bandes.find((b) => b.id === p.bande_id)?.box
    ajouter(cle(box == null ? null : calibreDuBox(boxes, box)), p.oeufs_collectes - p.oeufs_perdus)
  }
  for (const t of transactions) if (t.date > depart.date) ajouter(cle(t.calibre), -oeufsVendus(t, produits))

  if ((s.autre ?? 0) < 0) {
    const positifs = Object.fromEntries(CALIBRES.filter((c) => (s[c] ?? 0) > 0).map((c) => [c, s[c]!]))
    const retrait = auProrata(-s.autre!, positifs)
    for (const c of CALIBRES) if (retrait[c]) s[c] = (s[c] ?? 0) - retrait[c]!
    s.autre = 0
  }
  for (const k of ORDRE_CLES) if ((s[k] ?? 0) <= 0) delete s[k]
  return s
}

export interface JourStock {
  date: string
  /** Œufs bons ramassés ce jour-là, box par box. */
  entrees: { numero: number; calibre: Calibre | null; oeufs: number }[]
  /** Œufs vendus ce jour-là, par calibre. */
  sorties: Partial<Record<CleCalibre, number>>
}

/** Entrées (ramassage des box) et sorties (ventes) du magasin, jour par jour depuis l'inventaire, du plus récent au plus ancien. */
export function mouvementsStock({ pontes, transactions, produits, depart, bandes, boxes }: {
  pontes: Ponte[]; transactions: Transaction[]; produits: Produit[]; depart: StockDepart; bandes: Bande[]; boxes: BoxFerme[]
}): JourStock[] {
  const jours = new Map<string, JourStock>()
  const jour = (date: string) => {
    if (!jours.has(date)) jours.set(date, { date, entrees: [], sorties: {} })
    return jours.get(date)!
  }
  for (const p of pontes) {
    if (p.supprime_le || p.date <= depart.date) continue
    const numero = bandes.find((b) => b.id === p.bande_id)?.box
    if (numero == null) continue
    const j = jour(p.date)
    const deja = j.entrees.find((e) => e.numero === numero)
    if (deja) deja.oeufs += p.oeufs_collectes - p.oeufs_perdus
    else j.entrees.push({ numero, calibre: calibreDuBox(boxes, numero), oeufs: p.oeufs_collectes - p.oeufs_perdus })
  }
  for (const t of transactions) {
    const n = t.date > depart.date ? oeufsVendus(t, produits) : 0
    if (!n) continue
    const j = jour(t.date)
    j.sorties[cle(t.calibre)] = (j.sorties[cle(t.calibre)] ?? 0) + n
  }
  for (const j of jours.values()) j.entrees.sort((a, b) => a.numero - b.numero)
  return [...jours.values()].sort((a, b) => b.date.localeCompare(a.date))
}
