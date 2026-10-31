import type { Bande, Ponte } from '../../src/lib/types'

const b = (n: number, box: 1 | 2 | 3 | 4, naissance: string, effectif: number, reforme: string | null): Bande => ({
  id: `b${n}`, nom: `BANDE ${n}`, box, ouvrier_id: null, date_naissance: naissance, effectif_initial: effectif, date_reforme: reforme,
})

/** Les 6 bandes du classeur au 31/10/2026. */
export const BANDES: Bande[] = [
  b(1, 3, '2023-10-05', 680, '2024-12-15'),
  b(2, 4, '2024-06-06', 650, '2026-04-14'),
  b(3, 1, '2025-01-22', 600, null),
  b(4, 2, '2025-08-13', 650, null),
  b(5, 3, '2025-09-09', 620, null),
  b(6, 4, '2026-05-04', 2600, null),
]

export const ponte = (bande_id: string, date: string, p: Partial<Ponte> = {}): Ponte => ({
  id: `${bande_id}-${date}`, date, bande_id, oeufs_collectes: 0, oeufs_perdus: 0, mortalite: 0, aliment_kg: null, ...p,
})
