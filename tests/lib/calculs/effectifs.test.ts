import { boxesFerme } from '../../../src/lib/calculs/boxes'
import { effectifActuel, effectifPresent } from '../../../src/lib/calculs/bandes'
import { estimationEffectif, fiabiliteEffectif } from '../../../src/lib/calculs/effectifs'
import type { Mortalite, Recensement } from '../../../src/lib/types'
import { BANDES, ponte } from '../../fixtures/bandes'

const b5 = BANDES.find((b) => b.id === 'b5')!
const b6 = { ...BANDES.find((b) => b.id === 'b6')!, effectif_verifie: true }
const mort = (bande_id: string, date: string, nombre: number): Mortalite => ({ id: `m-${bande_id}-${date}`, bande_id, date, nombre })
// Une semaine de ponte de la BANDE 5 (59 semaines, taux attendu ≈ 71 %) : 1 980 œufs/jour pour 620 poules notées.
const semaine = Array.from({ length: 7 }, (_, i) => ponte('b5', `2026-10-${String(24 + i).padStart(2, '0')}`, { oeufs_collectes: 1980 }))

describe('Mortalités déclarées hors ponte', () => {
  it('se retranchent de l’effectif, comme celles notées avec la ponte', () => {
    const pontes = [ponte('b6', '2026-10-01', { mortalite: 3 })]
    const morts = [mort('b6', '2026-10-02', 10)]
    expect(effectifActuel(b6, pontes, undefined, [], morts)).toBe(2600 - 13)
    expect(effectifPresent(b6, pontes, '2026-10-02', [], morts)).toBe(2600 - 3)
  })

  it('avant un recomptage, ne comptent plus', () => {
    const r: Recensement = { id: 'r', bande_id: 'b6', date: '2026-10-05', effectif: 2500 }
    expect(effectifActuel(b6, [], undefined, [r], [mort('b6', '2026-10-02', 10), mort('b6', '2026-10-06', 4)])).toBe(2496)
  })
})

describe('Fiabilité de l’effectif', () => {
  it('estime l’effectif d’après la ponte et le taux attendu à cet âge', () => {
    const e = estimationEffectif(b5, semaine, '2026-10-31')!
    expect(e).toBeGreaterThan(2700)
    expect(e).toBeLessThan(2900)
    expect(e % 10).toBe(0)
  })

  it('signale une bande non vérifiée dont la ponte est impossible pour l’effectif noté', () => {
    const f = fiabiliteEffectif(b5, { pontes: semaine, recensements: [], mortalites: [] }, '2026-10-31')
    expect(f).toMatchObject({ verifie: false, note: 620, incoherent: true, oeufsJour: 1980 })
    expect(f.estime).toBeGreaterThan(2700)
  })

  it('une bande comptée (case cochée ou recomptage) est vérifiée', () => {
    expect(fiabiliteEffectif(b6, { pontes: [], recensements: [], mortalites: [] }, '2026-10-31').verifie).toBe(true)
    const r: Recensement = { id: 'r', bande_id: 'b5', date: '2026-10-20', effectif: 2800 }
    const f = fiabiliteEffectif(b5, { pontes: semaine, recensements: [r], mortalites: [] }, '2026-10-31')
    expect(f).toMatchObject({ verifie: true, note: 2800, incoherent: false })
  })

  it('sans ponte récente, pas d’estimation', () => {
    expect(estimationEffectif(b5, [], '2026-10-31')).toBeNull()
  })
})

describe('Boxes de la ferme', () => {
  it('par défaut, 4 boxes avec l’ouvrier de la bande en place', () => {
    const bandes = BANDES.map((b) => (b.id === 'b3' ? { ...b, ouvrier_id: 'fallou' } : b))
    expect(boxesFerme(null, bandes)).toEqual([
      { numero: 1, ouvrier_id: 'fallou' }, { numero: 2, ouvrier_id: null }, { numero: 3, ouvrier_id: null }, { numero: 4, ouvrier_id: null },
    ])
  })

  it('suit les réglages quand la ferme a ajouté des boxes', () => {
    const boxes = [{ numero: 5, ouvrier_id: null }, { numero: 1, ouvrier_id: 'daouda' }]
    expect(boxesFerme({ boxes }, BANDES).map((x) => x.numero)).toEqual([1, 5])
  })
})
