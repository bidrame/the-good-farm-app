import { moyenneCouts, prixDeRevient, produitsExclus } from '../../../src/lib/calculs/couts'
import { etatAliment, sacsLivres } from '../../../src/lib/calculs/aliment'
import { ponte } from '../../fixtures/bandes'
import { produit, tx } from '../../fixtures/tx'

const produits = [produit('p-oeufs', 'Œufs'), produit('p-alim', 'Aliment pondeuse', 'depense'), produit('p-sal', 'Salaires', 'depense'), produit('p-chair', 'Aliment chair', 'depense')]
const dep = (id: string, date: string, produit_id: string, montant: number, quantite = 1) =>
  tx({ id, date, type: 'depense', client_id: null, produit_id, prix_unitaire: montant / quantite, quantite, montant_paye: montant })
const vente = (id: string, date: string, plateaux: number, prix: number) => tx({ id, date, client_id: 'c', produit_id: 'p-oeufs', quantite: plateaux, prix_unitaire: prix, oeufs_par_unite: 30 })

describe('Prix de revient du plateau', () => {
  it('exclut d’office les dépenses qui ne servent pas les pondeuses', () => {
    expect(produitsExclus(produits)).toEqual(['p-chair'])
    expect(produitsExclus(produits, [])).toEqual([])
  })

  it('sans ponte saisie chaque jour, divise par les plateaux vendus', () => {
    const txs = [dep('a', '2026-09-03', 'p-alim', 860000, 50), dep('s', '2026-09-30', 'p-sal', 140000), dep('c', '2026-09-10', 'p-chair', 99999), vente('v', '2026-09-15', 1000, 2100)]
    const [, sept] = prixDeRevient({ transactions: txs, pontes: [], produits, exclus: produitsExclus(produits) }, '2026-10-31', 2)
    expect(sept).toMatchObject({ mois: '2026-09', depenses: 1000000, plateaux: 1000, base: 'ventes', coutPlateau: 1000, prixVente: 2100, marge: 1100 })
    expect(sept.postes.map((p) => [p.produit.nom, p.parPlateau])).toEqual([['Aliment pondeuse', 860], ['Salaires', 140]])
  })

  it('avec la ponte saisie tous les jours, divise par les plateaux produits (œufs cassés retirés)', () => {
    const pontes = Array.from({ length: 30 }, (_, i) => ponte('b6', `2026-09-${String(i + 1).padStart(2, '0')}`, { oeufs_collectes: 2010, oeufs_perdus: 10 }))
    const [, sept] = prixDeRevient({ transactions: [dep('a', '2026-09-03', 'p-alim', 2000000), vente('v', '2026-09-15', 1000, 2100)], pontes, produits, exclus: [] }, '2026-10-31', 2)
    expect(sept).toMatchObject({ base: 'ponte', plateaux: 2000, coutPlateau: 1000 })
  })

  it('fait la moyenne sur plusieurs mois en lissant les gros achats', () => {
    const txs = [dep('p', '2026-08-02', 'p-alim', 3000000), vente('v8', '2026-08-15', 1000, 2000), dep('a', '2026-09-03', 'p-alim', 1000000), vente('v9', '2026-09-15', 1000, 2200)]
    const liste = prixDeRevient({ transactions: txs, pontes: [], produits, exclus: [] }, '2026-09-30', 2)
    expect(moyenneCouts(liste)).toEqual({ coutPlateau: 2000, prixVente: 2100, marge: 100 })
  })
})

describe('Stock d’aliment', () => {
  it('retrouve le nombre de sacs d’une ligne saisie « 1 × montant total »', () => {
    expect(sacsLivres(dep('x', '2026-10-01', 'p-alim', 1720000, 1), 17200)).toBe(100)
    expect(sacsLivres(dep('y', '2026-10-01', 'p-alim', 1720000, 100), 17200)).toBe(100)
  })

  it('estime la consommation d’après les livraisons quand l’aliment n’est pas noté avec la ponte', () => {
    const txs = [dep('a', '2026-09-10', 'p-alim', 17200 * 600, 600), dep('b', '2026-10-20', 'p-alim', 17200 * 600, 600)]
    const e = etatAliment({ transactions: txs, pontes: [], produits }, '2026-10-31')
    expect(e).toMatchObject({ source: 'livraisons', kgParJour: 1000, stockKg: null, jours: null })
  })

  it('suit le stock depuis l’inventaire : + livraisons, − consommation notée ou moyenne', () => {
    const txs = [dep('a', '2026-09-10', 'p-alim', 17200 * 600, 600), dep('b', '2026-10-20', 'p-alim', 17200 * 600, 600), dep('c', '2026-10-29', 'p-alim', 17200 * 40, 40)]
    const pontes = [ponte('b6', '2026-10-29', { aliment_kg: 900 })]
    const e = etatAliment({ transactions: txs, pontes, produits, reglage: { stock: { date: '2026-10-28', sacs: 100 } } }, '2026-10-31')
    // Rythme : 1 240 sacs en 60 jours ≈ 1 033 kg/jour. Stock : 100 sacs + 40 livrés = 7 000 kg,
    // moins 900 (noté le 29) et 1 033 (moyenne le 30) ; le 31 n'est pas encore compté.
    expect(e.kgParJour).toBeCloseTo(1033.33, 1)
    expect(e).toMatchObject({ source: 'livraisons', livresDepuis: 40, stockKg: 5067, stockSacs: 101, jours: 4 })
  })

  it('préfère l’aliment noté avec la ponte s’il l’est presque chaque jour', () => {
    const pontes = Array.from({ length: 7 }, (_, i) => ponte('b6', `2026-10-${24 + i}`, { aliment_kg: 800 }))
    expect(etatAliment({ transactions: [], pontes, produits }, '2026-10-31')).toMatchObject({ source: 'ponte', kgParJour: 800 })
  })
})
