import { ajouterJours } from '../format'
import type { Bande, Box, BoxFerme, Calibre, DateISO, Ponte, Ramassage } from '../types'
import { auProrata, cle, ORDRE_CLES, parCalibre, type CleCalibre } from './calibres'
import { OEUFS_PAR_PLATEAU } from './oeufs'

/** Une bande compte dans un box si elle a une ponte saisie dans les 14 jours avant la période (ou pendant). */
const JOURS_ACTIVITE = 14
const JOURS_MOYENNE = 7

export interface Manquant { date: DateISO; bande_id: string }

export interface BoxRamassage {
  numero: Box
  ouvrier_id: string | null
  calibre: Calibre | null
  bandes: string[]
  /** Œufs bons (ramassés moins cassés) des jours saisis. */
  saisis: number
  /** Œufs estimés pour aujourd'hui (si pas encore saisi) et les jours à venir, d'après la moyenne des 7 derniers jours. */
  prevus: number
  total: number
  /** Jours passés sans ponte saisie : ils ne sont pas comptés. */
  manquants: Manquant[]
}

export interface InventaireTheorique {
  boxes: BoxRamassage[]
  saisis: number
  prevus: number
  total: number
}

const vivantes = <T extends { supprime_le?: string | null }>(l: T[]) => l.filter((x) => !x.supprime_le)
const bons = (p: Ponte) => p.oeufs_collectes - p.oeufs_perdus

function jours(du: DateISO, au: DateISO): DateISO[] {
  const liste: DateISO[] = []
  for (let d = du; d <= au; d = ajouterJours(d, 1)) liste.push(d)
  return liste
}

/** La voiture emporte les œufs pondus jusqu'à la veille de son passage : ceux du jour sont encore dans les box. */
export const finPonte = (jourRamassage: DateISO) => ajouterJours(jourRamassage, -1)

/** Sans passage enregistré, on remonte au plus loin de ces jours de ponte pour ne rien oublier dans le magasin. */
const JOURS_SANS_PASSAGE = 14

/**
 * Premier jour de ponte à ramasser : le jour du dernier passage (ses œufs sont restés).
 * Sans passage enregistré : le premier jour de ponte saisie des deux dernières semaines, sinon la veille.
 * Avec un passage chaque jour, le ramassage reprend donc exactement la ponte d'hier.
 */
export function debutPeriode(ramassages: Ramassage[], jourRamassage: DateISO, pontes: Ponte[] = []): DateISO {
  const dernier = dernierRamassage(ramassages.filter((r) => r.date <= jourRamassage))
  if (dernier) return dernier.date
  const fin = finPonte(jourRamassage)
  const limite = ajouterJours(jourRamassage, -JOURS_SANS_PASSAGE)
  const premier = pontes.filter((p) => !p.supprime_le && p.oeufs_collectes > 0 && p.date >= limite && p.date <= fin).map((p) => p.date).sort()[0]
  return premier ?? fin
}

export function dernierRamassage(ramassages: Ramassage[]): Ramassage | null {
  return vivantes(ramassages).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}

/** Moyenne des œufs bons par jour saisi, sur les 7 jours avant `date`. */
function moyenneBons(pontes: Ponte[], date: DateISO): number {
  const debut = ajouterJours(date, -JOURS_MOYENNE)
  const avant = pontes.filter((p) => p.date >= debut && p.date < date)
  return avant.length ? avant.reduce((s, p) => s + bons(p), 0) / avant.length : 0
}

/**
 * Œufs que la voiture doit trouver, box par box, pondus du `du` au `au` inclus.
 * Les jours passés viennent de la ponte saisie ; aujourd'hui (s'il n'est pas saisi) et les jours à venir sont estimés.
 */
export function inventaireTheorique(
  { bandes, pontes, boxes }: { bandes: Bande[]; pontes: Ponte[]; boxes: BoxFerme[] },
  du: DateISO,
  au: DateISO,
  aujourdhui: DateISO,
): InventaireTheorique {
  const ponteVivante = vivantes(pontes)
  const periode = jours(du, au)
  const debutActivite = ajouterJours(du, -JOURS_ACTIVITE)
  const numeros = [...new Set([...boxes.map((x) => x.numero), ...vivantes(bandes).map((b) => b.box)])].sort((a, b) => a - b)

  const lignes = numeros.map((numero): BoxRamassage => {
    const box = boxes.find((x) => x.numero === numero)
    const ligne: BoxRamassage = { numero, ouvrier_id: box?.ouvrier_id ?? null, calibre: box?.calibre ?? null, bandes: [], saisis: 0, prevus: 0, total: 0, manquants: [] }
    for (const b of vivantes(bandes).filter((x) => x.box === numero)) {
      const siennes = ponteVivante.filter((p) => p.bande_id === b.id)
      const enPonte = siennes.some((p) => p.date >= debutActivite && p.date <= au)
      if (!enPonte) continue
      ligne.bandes.push(b.id)
      const moyenne = moyenneBons(siennes, aujourdhui)
      for (const d of periode) {
        if (d < b.date_naissance || (b.date_reforme && d >= b.date_reforme)) continue
        const p = siennes.find((x) => x.date === d)
        if (p) ligne.saisis += bons(p)
        else if (d >= aujourdhui) ligne.prevus += Math.round(moyenne)
        else ligne.manquants.push({ date: d, bande_id: b.id })
      }
    }
    ligne.total = ligne.saisis + ligne.prevus
    return ligne
  })

  return {
    boxes: lignes,
    saisis: lignes.reduce((s, l) => s + l.saisis, 0),
    prevus: lignes.reduce((s, l) => s + l.prevus, 0),
    total: lignes.reduce((s, l) => s + l.total, 0),
  }
}

export const totalCharge = (r: Ramassage) => r.lignes.reduce((s, l) => s + l.charge, 0)
export const totalTheorique = (r: Ramassage) => r.lignes.reduce((s, l) => s + l.theorique, 0)
/** Œufs emportés le matin du passage : ils ne font pas partie du prévu de ce jour-là. */
export const totalMatin = (r: Ramassage) => r.lignes.reduce((s, l) => s + (l.matin ?? 0), 0)

/**
 * Œufs déjà emportés le matin du premier jour de la période : la ponte de ce jour, saisie le soir,
 * les compte déjà, il faut donc les retirer du prochain ramassage.
 */
export function dejaEmportes(ramassages: Ramassage[], du: DateISO): number {
  return ramassages.filter((r) => !r.supprime_le && r.date === du).reduce((s, r) => s + totalMatin(r), 0)
}

/** Les mêmes œufs du matin, calibre par calibre. */
export function emportesParCalibre(ramassages: Ramassage[], du: DateISO): Partial<Record<CleCalibre, number>> {
  const lignes = ramassages.filter((r) => !r.supprime_le && r.date === du).flatMap((r) => r.lignes)
  return parCalibre(lignes, (l) => l.calibre, (l) => l.matin ?? 0)
}

/**
 * Œufs à ramasser par calibre : la ponte des box selon leur calibre, moins ce qui est parti le matin du premier jour.
 */
export function aRamasserParCalibre(inv: InventaireTheorique, emportes: Partial<Record<CleCalibre, number>>): Partial<Record<CleCalibre, number>> {
  const ponte = parCalibre(inv.boxes, (b) => b.calibre, (b) => b.total)
  // Œufs du matin notés sous un calibre qui n'a plus de ponte (par exemple avant d'avoir classé les box) :
  // on les retire au prorata de la ponte, pour que le total reste juste.
  const orphelins = ORDRE_CLES.filter((k) => !ponte[k]).reduce((s, k) => s + (emportes[k] ?? 0), 0)
  const etales = auProrata(orphelins, ponte)
  const r: Partial<Record<CleCalibre, number>> = {}
  for (const k of ORDRE_CLES) {
    const n = Math.max(0, (ponte[k] ?? 0) - (ponte[k] ? emportes[k] ?? 0 : 0) - (etales[k] ?? 0))
    if (n > 0) r[k] = n
  }
  return r
}

/** Plateaux chargés et encore à répartir, calibre par calibre. */
export function resteParCalibre(r: Ramassage): Partial<Record<CleCalibre, number>> {
  const charges = parCalibre(r.lignes, (l) => l.calibre, (l) => l.charge / OEUFS_PAR_PLATEAU)
  // Un calibre vendu qui n'a pas été chargé à part (chargement non trié) se prend sur les « non classés ».
  const repartis = parCalibre(r.repartition ?? [], (l) => (charges[cle(l.calibre)] != null ? l.calibre : null), (l) => l.plateaux)
  const reste: Partial<Record<CleCalibre, number>> = {}
  for (const k of ORDRE_CLES) if (charges[k] != null) reste[k] = Math.round(charges[k]!) - (repartis[k] ?? 0)
  return reste
}

/** Plateaux répartis entre les clients, et ce qu'il reste du chargement à répartir. */
export function repartition(r: Ramassage): { repartis: number; reste: number } {
  const repartis = (r.repartition ?? []).reduce((s, l) => s + l.plateaux, 0)
  return { repartis, reste: Math.round(totalCharge(r) / OEUFS_PAR_PLATEAU) - repartis }
}
