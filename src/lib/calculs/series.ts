import type { Bande, Ponte } from '../types'
import { ageSemaines, effectifPresent } from './bandes'
import { tauxAttendu, tauxPonte } from './ponte'

export type PointSerie = { date: string; semaines: number; reel: number; attendu: number }

/** Taux réel et attendu, jour par jour, pour la courbe d'une bande. */
export function serieBande(b: Bande, pontes: Ponte[], courbe?: [number, number][]): PointSerie[] {
  return pontes
    .filter((p) => p.bande_id === b.id && !p.supprime_le)
    .sort((x, y) => x.date.localeCompare(y.date))
    .map((p) => {
      const semaines = ageSemaines({ ...b, date_reforme: null }, p.date)
      return { date: p.date, semaines, reel: tauxPonte(p.oeufs_collectes, effectifPresent(b, pontes, p.date)), attendu: tauxAttendu(semaines, courbe) }
    })
}
