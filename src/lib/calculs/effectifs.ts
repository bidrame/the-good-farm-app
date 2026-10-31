import { ajouterJours } from '../format'
import type { Bande, DateISO, Mortalite, Ponte, Recensement } from '../types'
import { ageSemaines, effectifActuel, estVerifiee } from './bandes'
import { tauxAttendu } from './ponte'

/** En dessous de ce taux attendu (début ou toute fin de ponte), l'estimation n'a pas de sens. */
const TAUX_MINIMUM_ESTIMATION = 0.3
/** Écart au-delà duquel l'effectif noté d'une bande non comptée est jugé douteux. */
const ECART_DOUTEUX = 0.3

/** Moyenne des œufs ramassés sur les 7 jours finissant à `ref` (jours saisis seulement). */
function oeufsParJour(b: Bande, pontes: Ponte[], ref: DateISO): number | null {
  const debut = ajouterJours(ref, -6)
  const jours = pontes.filter((p) => p.bande_id === b.id && !p.supprime_le && p.date >= debut && p.date <= ref && p.oeufs_collectes > 0)
  return jours.length ? jours.reduce((s, p) => s + p.oeufs_collectes, 0) / jours.length : null
}

/** Effectif probable d'après la ponte : œufs par jour ÷ taux attendu à cet âge, arrondi à la dizaine. */
export function estimationEffectif(b: Bande, pontes: Ponte[], ref: DateISO, courbe?: [number, number][]): number | null {
  const oeufs = oeufsParJour(b, pontes, ref)
  const taux = tauxAttendu(ageSemaines(b, ref), courbe ?? undefined)
  if (oeufs == null || taux < TAUX_MINIMUM_ESTIMATION) return null
  return Math.round(oeufs / taux / 10) * 10
}

export type Fiabilite = {
  verifie: boolean
  /** Effectif tenu par l'appli (initial ou recomptage, moins les morts). */
  note: number
  estime: number | null
  oeufsJour: number | null
  /** Plus d'œufs que de poules, ou bande non comptée très loin de l'estimation. */
  incoherent: boolean
}

export function fiabiliteEffectif(
  b: Bande,
  d: { pontes: Ponte[]; recensements: Recensement[]; mortalites: Mortalite[] },
  ref: DateISO,
  courbe?: [number, number][] | null,
): Fiabilite {
  const verifie = estVerifiee(b, d.recensements)
  const note = effectifActuel(b, d.pontes, ref, d.recensements, d.mortalites)
  const moyenne = oeufsParJour(b, d.pontes, ref)
  const estime = estimationEffectif(b, d.pontes, ref, courbe ?? undefined)
  const impossible = moyenne != null && moyenne > note
  const douteux = !verifie && estime != null && Math.abs(estime - note) / estime > ECART_DOUTEUX
  return { verifie, note, estime, oeufsJour: moyenne == null ? null : Math.round(moyenne), incoherent: impossible || douteux }
}
