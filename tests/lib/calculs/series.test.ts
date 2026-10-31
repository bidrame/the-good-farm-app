import { serieBande } from '../../../src/lib/calculs/series'
import { BANDES, ponte } from '../../fixtures/bandes'

describe('serieBande', () => {
  it('donne, jour par jour, le taux réel et le taux attendu', () => {
    const b = { ...BANDES[3], effectif_initial: 600 } // née le 13/08/2025
    const s = serieBande(b, [ponte('b4', '2026-10-31', { oeufs_collectes: 420 }), ponte('b4', '2026-10-30', { oeufs_collectes: 450 })])
    expect(s.map((p) => p.date)).toEqual(['2026-10-30', '2026-10-31'])
    expect(s[0].reel).toBeCloseTo(0.75, 5)
    expect(s[1].semaines).toBe(63)
    expect(s[1].attendu).toBeCloseTo(0.67, 5)
  })
})
