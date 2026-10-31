// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { lireClasseur } from '../../scripts/import/lireClasseur'
import { construireImport, totauxParAnnee } from '../../scripts/import/construireImport'

const CLASSEUR = 'tests/fixtures/classeur.xlsx'

// Le vrai classeur n'est jamais commité (données de la ferme) : ces tests ne tournent qu'en local.
describe.skipIf(!existsSync(CLASSEUR) || !existsSync('tests/fixtures/totaux-attendus.json'))('reprise du vrai classeur', () => {
  const lu = lireClasseur(CLASSEUR)

  it('lit 1 788 transactions du 26/09/2023 au 29/10/2026 et met de côté les 4 lignes sans montant', () => {
    expect(lu.transactions).toHaveLength(1788)
    expect(lu.rejets).toEqual([1786, 1787, 1788, 1789].map((ligne) => ({ feuille: 'Transactions', ligne, raison: 'montant nul' })))
    const dates = lu.transactions.map((t) => t.date).sort()
    expect([dates[0], dates.at(-1)]).toEqual(['2023-09-26', '2026-10-29'])
  })
  it('met les dépenses en positif avec quantité et prix positifs', () => {
    expect(lu.transactions.every((t) => t.montant > 0 && t.quantite > 0 && t.prix_unitaire > 0)).toBe(true)
    expect(lu.transactions.every((t) => t.montant === t.prix_unitaire * t.quantite)).toBe(true)
  })
  it('écrit Œufs avec le bon caractère', () => {
    expect(lu.transactions.filter((t) => t.produit === 'Œufs')).toHaveLength(623) // 626 lignes « Oeufs » dont 3 sans montant
    expect(lu.transactions.some((t) => t.produit === 'Oeufs')).toBe(false)
  })
  it('lit les 6 bandes avec box et dates', () => {
    expect(lu.bandes.map((b) => [b.nom, b.box, b.effectif_initial, b.date_reforme])).toEqual([
      ['BANDE 1', 3, 680, '2024-12-15'], ['BANDE 2', 4, 650, '2026-04-14'], ['BANDE 3', 1, 600, null],
      ['BANDE 4', 2, 650, null], ['BANDE 5', 3, 620, null], ['BANDE 6', 4, 2600, null],
    ])
    expect(lu.bandes[5].date_naissance).toBe('2026-05-04')
  })
  it('lit la ponte de mai et juin 2026 avec sa mortalité', () => {
    expect(lu.pontes).toHaveLength(19)
    expect(lu.pontes.every((p) => p.date >= '2026-05-01' && p.date <= '2026-06-30')).toBe(true)
    expect(lu.pontes.filter((p) => p.bande === 'BANDE 6').reduce((s, p) => s + p.mortalite, 0)).toBe(168)
  })
  it('retrouve exactement les totaux du classeur, au total et par année', () => {
    const imp = construireImport(lu, [])
    expect(totauxParAnnee(imp.transactions)).toEqual(JSON.parse(readFileSync('tests/fixtures/totaux-attendus.json', 'utf8')))
  })
})
