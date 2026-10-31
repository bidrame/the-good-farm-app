import type { Bande } from '../lib/types'

/** Couleur propre à chaque bande (d’après son box), la même partout : liste, fiche, ponte, accueil. */
export function teinteBande(b: Pick<Bande, 'box'>): string {
  const n = Number(b.box)
  return `var(--bande-${Number.isFinite(n) && n > 0 ? ((n - 1) % 6) + 1 : 1})`
}
