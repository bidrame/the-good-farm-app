import { joursEntre } from '../format'
import type { Bande, DateISO, Ponte, Recensement } from '../types'

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

/** Dernier recomptage de la bande dont la date passe le filtre. */
function dernierRecomptage(b: Bande, recensements: Recensement[], garder: (d: DateISO) => boolean): Recensement | undefined {
  return recensements
    .filter((r) => r.bande_id === b.id && !r.supprime_le && garder(r.date))
    .reduce<Recensement | undefined>((m, r) => (!m || r.date > m.date ? r : m), undefined)
}

/** Effectif au soir de `jusquA` (ou aujourd'hui) : dernier recomptage, sinon effectif initial, moins la mortalité notée depuis. */
export function effectifActuel(b: Bande, pontes: Ponte[], jusquA?: DateISO, recensements: Recensement[] = []): number {
  const dansPeriode = (d: DateISO) => jusquA === undefined || d <= jusquA
  const r = dernierRecomptage(b, recensements, dansPeriode)
  return (r?.effectif ?? b.effectif_initial) - mortalite(b, pontes, (d) => dansPeriode(d) && (!r || d > r.date))
}

/** Poules présentes le matin du jour donné (recomptages et mortalité des jours précédents). */
export function effectifPresent(b: Bande, pontes: Ponte[], date: DateISO, recensements: Recensement[] = []): number {
  const r = dernierRecomptage(b, recensements, (d) => d < date)
  return (r?.effectif ?? b.effectif_initial) - mortalite(b, pontes, (d) => d < date && (!r || d > r.date))
}

/** Poules manquantes constatées au recomptage : effectif attendu ce jour-là moins effectif compté. */
export function ecartRecomptage(b: Bande, pontes: Ponte[], r: Recensement, recensements: Recensement[]): number {
  const avant = recensements.filter((x) => x.id !== r.id && x.date < r.date)
  return effectifActuel(b, pontes, r.date, avant) - r.effectif
}

export function bandesEnProduction(bandes: Bande[], pontes: Ponte[], ref: DateISO): Bande[] {
  return bandes
    .filter((b) => !b.supprime_le && !b.date_reforme)
    .filter((b) => ageSemaines(b, ref) >= 18 || pontes.some((p) => p.bande_id === b.id && !p.supprime_le && p.oeufs_collectes > 0))
    .sort((a, b) => a.box - b.box)
}
