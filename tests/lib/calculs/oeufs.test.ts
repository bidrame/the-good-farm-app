import { CONDITIONNEMENTS_DEFAUT, enOeufs, decomposer, oeufsVendus, stockOeufs, statsVentesOeufs } from '../../../src/lib/calculs/oeufs'
import { ponte } from '../../fixtures/bandes'
import { produit, tx } from '../../fixtures/tx'

const produits = [produit('p-oeufs', 'Œufs'), produit('p-pf', 'Poulets frais')]
produits[1].unite = 'unite'

describe('conditionnements', () => {
  it('propose le plateau de 30 en premier, puis carton, boîtes et unité', () => {
    expect(CONDITIONNEMENTS_DEFAUT.map((c) => [c.nom, c.oeufs])).toEqual([
      ['Plateau de 30', 30], ['Carton de 12 plateaux', 360], ['Boîte de 12', 12], ['Boîte de 6', 6], ['À l’unité', 1],
    ])
  })
  it('convertit lots + restants en œufs et l’inverse', () => {
    expect(enOeufs(16, 30, 24)).toBe(504)
    expect(enOeufs(2, 360)).toBe(720)
    expect(decomposer(504, 30)).toEqual({ lots: 16, restants: 24 })
    expect(decomposer(25, 12)).toEqual({ lots: 2, restants: 1 })
  })
})

describe('oeufsVendus', () => {
  it('compte les œufs d’une vente selon son conditionnement (30 par défaut)', () => {
    expect(oeufsVendus(tx({ produit_id: 'p-oeufs', quantite: 10 }), produits)).toBe(300)
    expect(oeufsVendus(tx({ produit_id: 'p-oeufs', quantite: 5, oeufs_par_unite: 12 }), produits)).toBe(60)
  })
  it('ignore les autres produits, les dépenses et les lignes supprimées', () => {
    expect(oeufsVendus(tx({ produit_id: 'p-pf', quantite: 10 }), produits)).toBe(0)
    expect(oeufsVendus(tx({ produit_id: 'p-oeufs', type: 'depense', quantite: 10 }), produits)).toBe(0)
    expect(oeufsVendus(tx({ produit_id: 'p-oeufs', quantite: 10, supprime_le: '2026-10-31' }), produits)).toBe(0)
  })
})

describe('stockOeufs', () => {
  it('part de l’inventaire et ajoute la ponte, retire pertes et ventes des jours suivants', () => {
    const pontes = [
      ponte('b4', '2026-10-30', { oeufs_collectes: 999 }), // le jour de l'inventaire : déjà compté
      ponte('b4', '2026-10-31', { oeufs_collectes: 500, oeufs_perdus: 10 }),
      ponte('b5', '2026-10-31', { oeufs_collectes: 400 }),
    ]
    const txs = [
      tx({ date: '2026-10-30', produit_id: 'p-oeufs', quantite: 50 }),
      tx({ date: '2026-10-31', produit_id: 'p-oeufs', quantite: 20 }),
    ]
    expect(stockOeufs({ pontes, transactions: txs, produits, depart: { date: '2026-10-30', oeufs: 300 } })).toBe(300 + 890 - 600)
  })
  it('vaut l’inventaire seul quand rien ne s’est passé depuis', () => {
    expect(stockOeufs({ pontes: [], transactions: [], produits, depart: { date: '2026-10-31', oeufs: 120 } })).toBe(120)
  })
})

describe('statsVentesOeufs', () => {
  it('donne les œufs vendus, les plateaux équivalents et le prix moyen du plateau', () => {
    const txs = [
      tx({ produit_id: 'p-oeufs', quantite: 10, prix_unitaire: 2300 }),
      tx({ produit_id: 'p-oeufs', quantite: 5, oeufs_par_unite: 12, prix_unitaire: 1000 }),
    ]
    const s = statsVentesOeufs(txs, produits)
    expect(s.oeufs).toBe(360)
    expect(s.plateaux).toBe(12)
    expect(s.prixMoyenPlateau).toBe(Math.round((23000 + 5000) / 12))
  })
  it('évite la division par zéro', () => {
    expect(statsVentesOeufs([], produits)).toEqual({ oeufs: 0, plateaux: 0, montant: 0, prixMoyenPlateau: null })
  })
})
