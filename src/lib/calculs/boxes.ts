import type { Bande, BoxFerme, Reglages } from '../types'

/** Nombre de boxes de la ferme avant tout réglage. */
export const BOXES_DEPART = 4

/** Boxes de la ferme : ceux des réglages, sinon 1 à 4 avec l'ouvrier de la bande qui y est. */
export function boxesFerme(reglages: Pick<Reglages, 'boxes'> | null | undefined, bandes: Bande[]): BoxFerme[] {
  if (reglages?.boxes?.length) return [...reglages.boxes].sort((a, b) => a.numero - b.numero)
  const actives = bandes.filter((b) => !b.supprime_le && !b.date_reforme)
  const n = Math.max(BOXES_DEPART, ...actives.map((b) => b.box))
  return Array.from({ length: n }, (_, i) => ({ numero: i + 1, ouvrier_id: actives.find((b) => b.box === i + 1)?.ouvrier_id ?? null }))
}

export function ouvrierDuBox(boxes: BoxFerme[], numero: number): string | null {
  return boxes.find((x) => x.numero === numero)?.ouvrier_id ?? null
}
