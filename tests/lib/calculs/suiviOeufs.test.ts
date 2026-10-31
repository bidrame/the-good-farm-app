import { effectifActuel, effectifPresent, ecartRecomptage } from '../../../src/lib/calculs/bandes'
import { serieOeufs, tendanceOeufs, oeufsFerme } from '../../../src/lib/calculs/suiviOeufs'
import { BANDES, ponte } from '../../fixtures/bandes'
import type { Recensement } from '../../../src/lib/types'

const b6 = BANDES[5] // effectif initial 2600
const pontes = [ponte('b6', '2026-05-05', { mortalite: 2 }), ponte('b6', '2026-05-17', { mortalite: 1 })]
const rec = (date: string, effectif: number): Recensement => ({ id: `r-${date}`, bande_id: 'b6', date, effectif })

describe('recomptage de la bande', () => {
  const recs = [rec('2026-05-10', 2500)]
  it('repart de l’effectif compté, puis retire la mortalité notée ensuite', () => {
    expect(effectifActuel(b6, pontes, undefined, recs)).toBe(2499)
    expect(effectifActuel(b6, pontes, '2026-05-12', recs)).toBe(2500)
    expect(effectifActuel(b6, pontes, '2026-05-08', recs)).toBe(2598)
  })
  it('le recomptage vaut pour les jours suivants', () => {
    expect(effectifPresent(b6, pontes, '2026-05-10', recs)).toBe(2598)
    expect(effectifPresent(b6, pontes, '2026-05-11', recs)).toBe(2500)
    expect(effectifPresent(b6, pontes, '2026-05-18', recs)).toBe(2499)
  })
  it('prend le dernier recomptage', () => {
    expect(effectifActuel(b6, pontes, undefined, [...recs, rec('2026-05-20', 2480)])).toBe(2480)
  })
  it('donne l’écart constaté au recomptage (mortalité non notée)', () => {
    expect(ecartRecomptage(b6, pontes, recs[0], recs)).toBe(98)
    expect(ecartRecomptage(b6, pontes, rec('2026-05-20', 2480), [...recs, rec('2026-05-20', 2480)])).toBe(19)
  })
  it('ignore les recomptages d’une autre bande ou supprimés', () => {
    expect(effectifActuel(b6, pontes, undefined, [{ ...recs[0], bande_id: 'b5' }, { ...rec('2026-05-12', 1), supprime_le: 'x' }])).toBe(2597)
  })
})

describe('œufs par jour', () => {
  const jours = (valeurs: number[]) => valeurs.map((oeufs_collectes, i) => ponte('b4', `2026-10-${String(20 + i).padStart(2, '0')}`, { oeufs_collectes }))
  it('donne chaque jour les œufs et la moyenne des 7 jours précédents', () => {
    const s = serieOeufs('b4', jours([500, 510, 490, 500, 520, 480, 500, 400]))
    expect(s[0]).toEqual({ date: '2026-10-20', oeufs: 500, moyenne7: null })
    expect(s[7]).toEqual({ date: '2026-10-27', oeufs: 400, moyenne7: 500 })
  })
  it('mesure la tendance d’un jour par rapport à la moyenne de la bande', () => {
    const t = tendanceOeufs('b4', jours([500, 510, 490, 500, 520, 480, 500, 400]), '2026-10-27')
    expect(t).toEqual({ oeufs: 400, moyenne: 500, ecart: -0.2 })
    expect(tendanceOeufs('b4', jours([500]), '2026-10-27')).toBeNull()
  })
  it('totalise la ferme pour un jour', () => {
    expect(oeufsFerme([ponte('b4', '2026-10-30', { oeufs_collectes: 500 }), ponte('b5', '2026-10-30', { oeufs_collectes: 420 }), ponte('b4', '2026-10-29', { oeufs_collectes: 9 })], '2026-10-30')).toBe(920)
  })
})
