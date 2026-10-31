export const OEUFS_PAR_PLAQUE = 30

/** Taux de ponte attendu selon l'âge (semaines → taux), repris du classeur. */
export const COURBE_DEFAUT: [number, number][] = [
  [20, 0.05], [22, 0.5], [24, 0.8], [26, 0.9], [30, 0.93], [35, 0.9],
  [40, 0.85], [50, 0.78], [60, 0.7], [65, 0.65], [70, 0.6], [72, 0.55],
]

export function plaquesEnOeufs(plaques: number, restants: number): number {
  return plaques * OEUFS_PAR_PLAQUE + restants
}

export function oeufsEnPlaques(n: number): { plaques: number; restants: number } {
  return { plaques: Math.floor(n / OEUFS_PAR_PLAQUE), restants: n % OEUFS_PAR_PLAQUE }
}

export function tauxPonte(oeufs: number, effectif: number): number {
  return effectif > 0 ? oeufs / effectif : 0
}

export function tauxAttendu(semaines: number, courbe: [number, number][] = COURBE_DEFAUT): number {
  const pts = [...courbe].sort((a, b) => a[0] - b[0])
  if (pts.length === 0 || semaines < pts[0][0]) return 0
  const dernier = pts[pts.length - 1]
  if (semaines >= dernier[0]) return dernier[1]
  for (let i = 0; i < pts.length - 1; i++) {
    const [s0, t0] = pts[i]
    const [s1, t1] = pts[i + 1]
    if (semaines >= s0 && semaines <= s1) return t0 + ((t1 - t0) * (semaines - s0)) / (s1 - s0)
  }
  return dernier[1]
}

/** Grammes d'aliment par œuf collecté. */
export function indiceConso(alimentKg: number | null, oeufs: number): number | null {
  if (alimentKg == null || oeufs <= 0) return null
  return (alimentKg * 1000) / oeufs
}
