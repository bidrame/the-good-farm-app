import { formatFCFA, formatDate, parseMontant, joursEntre, ajouterJours, aujourdhui } from '../../src/lib/format'

const esp = (s: string) => s.replace(/\s/g, ' ')

describe('formatFCFA', () => {
  it('sépare les milliers par un espace et ajoute F', () => {
    expect(esp(formatFCFA(52000))).toBe('52 000 F')
  })
  it('garde le signe des montants négatifs', () => {
    expect(esp(formatFCFA(-4085930))).toBe('-4 085 930 F')
  })
})

describe('formatDate', () => {
  it('affiche JJ/MM/AAAA', () => {
    expect(formatDate('2026-10-31')).toBe('31/10/2026')
  })
})

describe('parseMontant', () => {
  it.each([
    ['2 300', 2300],
    ['2.300', 2300],
    ['2 300', 2300],
    ['2 300', 2300],
    ['2,300', 2300],
    ['1.250.000', 1250000],
    ['1 250 000', 1250000],
    ['52000', 52000],
  ])('lit %j comme %d', (s, n) => {
    expect(parseMontant(s)).toBe(n)
  })
  it.each(['', '   ', 'abc', '2,5', '2300,5', '12.3456', '-5'])('refuse %j (vide, décimal ou négatif)', (s) => {
    expect(parseMontant(s)).toBeNull()
  })
})

describe('dates ISO', () => {
  it('compte les jours entre deux dates', () => {
    expect(joursEntre('2026-05-04', '2026-10-31')).toBe(180)
  })
  it('ajoute des jours en passant le mois', () => {
    expect(ajouterJours('2026-02-27', 2)).toBe('2026-03-01')
  })
  it("donne la date du jour au format ISO", () => {
    expect(aujourdhui()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
