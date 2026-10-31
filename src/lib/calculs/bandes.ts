import { joursEntre } from '../format'
import type { Bande, DateISO, Ponte } from '../types'

export type Phase = 'demarrage' | 'croissance' | 'pre_ponte' | 'ponte' | 'fin_de_cycle'

export const LIBELLE_PHASE: Record<Phase, string> = {
  demarrage: 'Démarrage',
  croissance: 'Croissance',
  pre_ponte: 'Pré-ponte',
  ponte: 'Ponte',
  fin_de_cycle: 'Fin de cycle',
}

/** Âge entier en semaines ; s'arrête à la date de réforme. */
export function ageSemaines(b: Bande, ref: DateISO): number {
  const fin = b.date_reforme ?? ref
  return Math.floor(joursEntre(b.date_naissance, fin) / 7)
}

export function phase(semaines: number): Phase {
  if (semaines < 6) return 'demarrage'
  if (semaines < 18) return 'croissance'
  if (semaines < 20) return 'pre_ponte'
  if (semaines < 72) return 'ponte'
  return 'fin_de_cycle'
}

function mortalite(b: Bande, pontes: Ponte[], garder: (d: DateISO) => boolean): number {
  return pontes
    .filter((p) => p.bande_id === b.id && !p.supprime_le && garder(p.date))
    .reduce((s, p) => s + p.mortalite, 0)
}

export function effectifActuel(b: Bande, pontes: Ponte[], jusquA?: DateISO): number {
  return b.effectif_initial - mortalite(b, pontes, (d) => jusquA === undefined || d <= jusquA)
}

/** Poules présentes le matin du jour donné (mortalité des jours précédents). */
export function effectifPresent(b: Bande, pontes: Ponte[], date: DateISO): number {
  return b.effectif_initial - mortalite(b, pontes, (d) => d < date)
}

export function bandesEnProduction(bandes: Bande[], pontes: Ponte[], ref: DateISO): Bande[] {
  return bandes
    .filter((b) => !b.supprime_le && !b.date_reforme)
    .filter((b) => ageSemaines(b, ref) >= 18 || pontes.some((p) => p.bande_id === b.id && !p.supprime_le && p.oeufs_collectes > 0))
    .sort((a, b) => a.box - b.box)
}
