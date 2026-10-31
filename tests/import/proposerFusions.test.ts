import { proposerFusions } from '../../scripts/import/proposerFusions'

describe('proposerFusions', () => {
  const r = proposerFusions(['ABABACAR', 'ABABACAR', 'ababacar', 'ababcar', 'Babacar', 'Babacar sicap M', 'Koné', 'kone', 'aliment', 'Dame'])
  it('fusionne sans risque les variantes de casse et d’accents, en gardant la plus fréquente', () => {
    expect(r.sures).toEqual(expect.arrayContaining([
      { garder: 'ABABACAR', fusionner: ['ababacar'] },
      { garder: expect.stringMatching(/^(Koné|kone)$/), fusionner: [expect.stringMatching(/^(Koné|kone)$/)] },
    ]))
  })
  it('signale à vérifier les noms à une lettre près', () => {
    expect(r.aVerifier).toContainEqual({ a: 'ABABACAR', b: 'ababcar', raison: 'une lettre de différence' })
  })
  it('ne fusionne jamais des clients différents', () => {
    const tout = JSON.stringify(r)
    expect(r.sures.some((s) => [s.garder, ...s.fusionner].includes('Babacar sicap M'))).toBe(false)
    expect(tout).not.toMatch(/"Babacar"[^\]]*"Babacar sicap M"/)
  })
  it('repère les valeurs qui ne sont pas des clients', () => {
    expect(r.pasClients).toEqual(['aliment'])
  })
})
