import { ajouterJours } from '../format'
import type { DateISO, Ponte } from '../types'

const JOURS_MOYENNE = 7

function pontesBande(bandeId: string, pontes: Ponte[]) {
  return pontes.filter((p) => p.bande_id === bandeId && !p.supprime_le).sort((a, b) => a.date.localeCompare(b.date))
}

/** Moyenne des œufs des 7 jours précédant `date` (jours saisis seulement) ; null si aucun. */
function moyenneAvant(liste: Ponte[], date: DateISO): number | null {
  const debut = ajouterJours(date, -JOURS_MOYENNE)
  const avant = liste.filter((p) => p.date >= debut && p.date < date)
  return avant.length ? avant.reduce((s, p) => s + p.oeufs_collectes, 0) / avant.length : null
}

/** Moyenne des œufs de la bande sur les 7 jours précédant `date`. */
export function moyenneOeufs7(bandeId: string, pontes: Ponte[], date: DateISO): number | null {
  return moyenneAvant(pontesBande(bandeId, pontes), date)
}

/** Classe d'affichage d'un écart à la moyenne (seuil de baisse en %). */
export function couleurTendance(ecart: number, seuilPct = 15): 'ok' | 'moyen' | 'mauvais' {
  if (ecart >= -0.05) return 'ok'
  if (-ecart * 100 <= seuilPct) return 'moyen'
  return 'mauvais'
}

/** Œufs ramassés chaque jour par la bande, avec la moyenne mobile des 7 jours précédents. */
export function serieOeufs(bandeId: string, pontes: Ponte[]): { date: DateISO; oeufs: number; moyenne7: number | null }[] {
  const liste = pontesBande(bandeId, pontes)
  return liste.map((p) => ({ date: p.date, oeufs: p.oeufs_collectes, moyenne7: moyenneAvant(liste, p.date) }))
}

/** Œufs d'un jour comparés à la moyenne de la bande (ecart : -0,2 = 20 % de moins). */
export function tendanceOeufs(bandeId: string, pontes: Ponte[], date: DateISO): { oeufs: number; moyenne: number; ecart: number } | null {
  const liste = pontesBande(bandeId, pontes)
  const jour = liste.find((p) => p.date === date)
  const moyenne = moyenneAvant(liste, date)
  if (!jour || moyenne == null || moyenne === 0) return null
  return { oeufs: jour.oeufs_collectes, moyenne, ecart: Math.round(((jour.oeufs_collectes - moyenne) / moyenne) * 1000) / 1000 }
}

export function oeufsFerme(pontes: Ponte[], date: DateISO): number {
  return pontes.filter((p) => p.date === date && !p.supprime_le).reduce((s, p) => s + p.oeufs_collectes, 0)
}
