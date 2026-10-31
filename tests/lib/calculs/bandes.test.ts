import { ageSemaines, phase, effectifActuel, effectifPresent, bandesEnProduction } from '../../../src/lib/calculs/bandes'
import { BANDES, ponte } from '../../fixtures/bandes'

const [b1, , , , , b6] = BANDES
const pontesB6 = [ponte('b6', '2026-05-05', { mortalite: 2 }), ponte('b6', '2026-05-17', { mortalite: 1 })]

describe('ageSemaines', () => {
  it("compte les semaines jusqu'à la date de référence", () => {
    expect(ageSemaines(b6, '2026-10-31')).toBe(25)
  })
  it("s'arrête à la date de réforme", () => {
    expect(ageSemaines(b1, '2026-10-31')).toBe(62)
  })
})

describe('phase', () => {
  it.each([
    [5, 'demarrage'], [6, 'croissance'], [17, 'croissance'], [18, 'pre_ponte'],
    [20, 'ponte'], [71, 'ponte'], [72, 'fin_de_cycle'],
  ] as const)('%d semaines → %s', (s, p) => {
    expect(phase(s)).toBe(p)
  })
})

describe('effectif', () => {
  it('retire toute la mortalité saisie', () => {
    expect(effectifActuel(b6, pontesB6)).toBe(2597)
  })
  it("ne compte que la mortalité jusqu'à la date donnée", () => {
    expect(effectifActuel(b6, pontesB6, '2026-05-10')).toBe(2598)
  })
  it('effectif présent un jour = avant la mortalité de ce jour', () => {
    expect(effectifPresent(b6, pontesB6, '2026-05-05')).toBe(2600)
    expect(effectifPresent(b6, pontesB6, '2026-05-06')).toBe(2598)
  })
  it("ignore la mortalité d'une autre bande et les pontes supprimées", () => {
    const autres = [ponte('b5', '2026-05-05', { mortalite: 9 }), { ...ponte('b6', '2026-05-07', { mortalite: 9 }), supprime_le: '2026-05-08' }]
    expect(effectifActuel(b6, autres)).toBe(2600)
  })
})

describe('bandesEnProduction', () => {
  it('donne les 4 bandes en production au 31/10/2026, par box', () => {
    expect(bandesEnProduction(BANDES, [], '2026-10-31').map((b) => b.nom)).toEqual(['BANDE 3', 'BANDE 4', 'BANDE 5', 'BANDE 6'])
  })
  it('inclut une jeune bande dès ses premiers œufs', () => {
    const jeune = { ...b6, id: 'b7', box: 1 as const, date_naissance: '2026-07-01' }
    expect(bandesEnProduction([jeune], [], '2026-10-31')).toEqual([])
    expect(bandesEnProduction([jeune], [ponte('b7', '2026-10-30', { oeufs_collectes: 3 })], '2026-10-31')).toEqual([jeune])
  })
})
