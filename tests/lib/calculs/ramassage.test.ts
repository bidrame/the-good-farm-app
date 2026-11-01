import { debutPeriode, finPonte, inventaireTheorique, repartition } from '../../../src/lib/calculs/ramassage'
import type { Ramassage } from '../../../src/lib/types'
import { BANDES, ponte } from '../../fixtures/bandes'

const boxes = [1, 2, 3, 4].map((numero) => ({ numero, ouvrier_id: numero === 1 ? 'fallou' : null }))
// BANDE 3 (box 1) : 300 œufs par jour dont 10 cassés, du 25 au 30 octobre ; rien le 28.
const pontes = ['25', '26', '27', '29', '30'].map((j) => ponte('b3', `2026-10-${j}`, { oeufs_collectes: 300, oeufs_perdus: 10 }))
const ram = (date: string, lignes: Ramassage['lignes'] = []): Ramassage => ({ id: date, date, du: date, lignes })

describe('Inventaire théorique du ramassage', () => {
  it('compte les œufs bons de chaque box et signale les jours non saisis', () => {
    const inv = inventaireTheorique({ bandes: BANDES, pontes, boxes }, '2026-10-26', '2026-10-30', '2026-10-31')
    const box1 = inv.boxes.find((b) => b.numero === 1)!
    expect(box1).toMatchObject({ ouvrier_id: 'fallou', bandes: ['b3'], saisis: 4 * 290, prevus: 0, total: 1160 })
    expect(box1.manquants).toEqual([{ date: '2026-10-28', bande_id: 'b3' }])
    expect(inv.total).toBe(1160)
  })

  it('estime aujourd’hui et les jours à venir d’après la moyenne des 7 derniers jours', () => {
    const inv = inventaireTheorique({ bandes: BANDES, pontes, boxes }, '2026-10-30', '2026-11-02', '2026-10-31')
    const box1 = inv.boxes.find((b) => b.numero === 1)!
    expect(box1).toMatchObject({ saisis: 290, prevus: 3 * 290, total: 4 * 290, manquants: [] })
  })

  it('ignore les bandes réformées et celles sans ponte récente', () => {
    const inv = inventaireTheorique({ bandes: BANDES, pontes: [...pontes, ponte('b1', '2024-12-01', { oeufs_collectes: 500 })], boxes }, '2026-10-26', '2026-10-30', '2026-10-31')
    expect(inv.boxes.find((b) => b.numero === 3)).toMatchObject({ bandes: [], total: 0, manquants: [] })
  })

  it('emporte la ponte jusqu’à la veille du passage, à partir du jour du passage précédent', () => {
    expect(finPonte('2026-10-31')).toBe('2026-10-30')
    expect(debutPeriode([], '2026-10-31')).toBe('2026-10-30') // passage quotidien : la ponte d'hier
    expect(debutPeriode([ram('2026-10-24'), ram('2026-10-28')], '2026-10-31')).toBe('2026-10-28') // ses œufs du 28 étaient restés
  })

  it('sans passage enregistré, reprend toute la ponte pas encore emportée', () => {
    const p = [ponte('b3', '2026-10-30', { oeufs_collectes: 300 }), ponte('b3', '2026-10-31', { oeufs_collectes: 300 }), ponte('b3', '2026-10-01', { oeufs_collectes: 300 })]
    expect(debutPeriode([], '2026-11-01', p)).toBe('2026-10-30') // le 30 et le 31 sont encore au magasin
    expect(debutPeriode([], '2026-11-01', [])).toBe('2026-10-31')
  })

  it('compte ce qu’il reste à répartir entre les clients', () => {
    const r = { ...ram('2026-10-30', [{ numero: 1, theorique: 3000, charge: 3000 }]), repartition: [{ client_id: 'c', plateaux: 40, prix: 2100, transaction_id: 't' }] }
    expect(repartition(r)).toEqual({ repartis: 40, reste: 60 })
  })
})

describe('Œufs emportés le matin', () => {
  it('retire du ramassage suivant ce que la voiture a pris le matin du jour où la période commence', async () => {
    const { dejaEmportes, totalMatin } = await import('../../../src/lib/calculs/ramassage')
    const matin = { id: 'm', date: '2026-10-31', du: '2026-10-30', lignes: [{ numero: 0, theorique: 6180, charge: 6180 + 2400, matin: 2400 }] }
    expect(totalMatin(matin)).toBe(2400)
    expect(dejaEmportes([matin], '2026-10-31')).toBe(2400)
    expect(dejaEmportes([matin], '2026-11-01')).toBe(0)
    expect(dejaEmportes([{ ...matin, supprime_le: '2026-11-01' }], '2026-10-31')).toBe(0)
  })
})

describe('Œufs à ramasser par calibre', () => {
  it('retire aussi les œufs du matin notés avant le classement des box, au prorata', async () => {
    const { aRamasserParCalibre } = await import('../../../src/lib/calculs/ramassage')
    const inv = { saisis: 0, prevus: 0, total: 900, boxes: [
      { numero: 1, ouvrier_id: null, calibre: 'gros' as const, bandes: ['b'], saisis: 600, prevus: 0, total: 600, manquants: [] },
      { numero: 2, ouvrier_id: null, calibre: 'petit' as const, bandes: ['b'], saisis: 300, prevus: 0, total: 300, manquants: [] },
    ] }
    expect(aRamasserParCalibre(inv, { gros: 60 })).toEqual({ gros: 540, petit: 300 })
    expect(aRamasserParCalibre(inv, { autre: 90 })).toEqual({ gros: 540, petit: 270 })
  })
})

describe('Stock du magasin par calibre', () => {
  it('inventaire + ponte des box selon leur calibre − ventes de chaque calibre', async () => {
    const { stockParCalibre } = await import('../../../src/lib/calculs/calibres')
    const produits = [{ id: 'p-oeufs', nom: 'Œufs', type: 'vente' as const, unite: 'plaque' as const, actif: true }]
    const vente = (id: string, quantite: number, calibre: 'gros' | 'petit' | null) =>
      ({ id, date: '2026-10-31', type: 'vente' as const, client_id: 'c', produit_id: 'p-oeufs', quantite, prix_unitaire: 2000, montant: 0, montant_paye: 0, oeufs_par_unite: 30, calibre })
    const boxes2 = [{ numero: 1, ouvrier_id: null, calibre: 'gros' as const }, { numero: 2, ouvrier_id: null, calibre: 'petit' as const }]
    const pontes = [ponte('b3', '2026-10-30', { oeufs_collectes: 610, oeufs_perdus: 10 }), ponte('b4', '2026-10-30', { oeufs_collectes: 300 })]
    const depart = { date: '2026-10-29', oeufs: 1500, par_calibre: { gros: 900, petit: 300 } } // + 300 non triés
    expect(stockParCalibre({ pontes, transactions: [vente('v1', 10, 'gros')], produits, depart, bandes: BANDES, boxes: boxes2 }))
      .toEqual({ gros: 900 + 600 - 300, petit: 300 + 300, autre: 300 })
    // Des ventes sans calibre au-delà des non triés se prennent sur les autres calibres, au prorata.
    const s = stockParCalibre({ pontes, transactions: [vente('v2', 20, null)], produits, depart, bandes: BANDES, boxes: boxes2 })
    expect(s.autre).toBeUndefined()
    expect((s.gros ?? 0) + (s.petit ?? 0)).toBe(1500 + 900 - 600)
  })
})
