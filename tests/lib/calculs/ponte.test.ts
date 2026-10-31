import { plaquesEnOeufs, oeufsEnPlaques, tauxPonte, tauxAttendu, indiceConso } from '../../../src/lib/calculs/ponte'

describe('plaques', () => {
  it('convertit plaques de 30 + restants en œufs', () => {
    expect(plaquesEnOeufs(16, 24)).toBe(504)
  })
  it('convertit des œufs en plaques + restants', () => {
    expect(oeufsEnPlaques(504)).toEqual({ plaques: 16, restants: 24 })
  })
})

describe('tauxPonte', () => {
  it('divise les œufs par l’effectif présent', () => {
    expect(tauxPonte(504, 572)).toBeCloseTo(0.881, 3)
  })
  it('vaut 0 quand l’effectif est nul (jamais Infinity)', () => {
    expect(tauxPonte(10, 0)).toBe(0)
    expect(tauxPonte(0, 0)).toBe(0)
  })
})

describe('tauxAttendu', () => {
  it('vaut 0 avant 20 semaines', () => {
    expect(tauxAttendu(19)).toBe(0)
  })
  it('reprend les points de la courbe', () => {
    expect(tauxAttendu(20)).toBe(0.05)
    expect(tauxAttendu(30)).toBe(0.93)
  })
  it('interpole entre deux points', () => {
    expect(tauxAttendu(28)).toBeCloseTo(0.915, 3)
  })
  it('reste à 55 % après 72 semaines', () => {
    expect(tauxAttendu(90)).toBe(0.55)
  })
  it('utilise une courbe personnalisée', () => {
    expect(tauxAttendu(25, [[20, 0.5], [30, 0.7]])).toBeCloseTo(0.6, 5)
  })
})

describe('indiceConso', () => {
  it('donne les grammes d’aliment par œuf', () => {
    expect(indiceConso(65, 504)).toBeCloseTo(129, 0)
  })
  it('est vide sans œufs ou sans aliment', () => {
    expect(indiceConso(65, 0)).toBeNull()
    expect(indiceConso(null, 504)).toBeNull()
  })
})
