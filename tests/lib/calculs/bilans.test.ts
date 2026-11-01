import { bilanMensuel, bilanAnnuel, parProduit, classementClients, margeBruteMois, produitsDirects } from '../../../src/lib/calculs/bilans'
import { tx, client, produit } from '../../fixtures/tx'

describe('bilanMensuel', () => {
  it('regroupe par mois avec résultat et cumul, sans décalage en fin de mois', () => {
    const txs = [tx({ date: '2026-01-31', prix_unitaire: 1000 }), tx({ date: '2026-02-01', type: 'depense', prix_unitaire: 400 })]
    expect(bilanMensuel(txs)).toEqual([
      { periode: '2026-01', ventes: 1000, depenses: 0, resultat: 1000, cumul: 1000 },
      { periode: '2026-02', ventes: 0, depenses: 400, resultat: -400, cumul: 600 },
    ])
  })
  it('ignore les lignes supprimées', () => {
    expect(bilanMensuel([tx({ prix_unitaire: 1000, supprime_le: '2026-10-31' })])).toEqual([])
  })
})

describe('bilanAnnuel', () => {
  it('regroupe par année', () => {
    const txs = [tx({ date: '2025-12-31', prix_unitaire: 300 }), tx({ date: '2026-01-01', prix_unitaire: 200 })]
    expect(bilanAnnuel(txs).map((l) => [l.periode, l.ventes, l.cumul])).toEqual([['2025', 300, 300], ['2026', 200, 500]])
  })
})

describe('parProduit', () => {
  it('donne montant, quantité et part par produit du type demandé', () => {
    const produits = [produit('p-oeufs', 'Œufs'), produit('p-poulet', 'Poulets frais'), produit('p-alim', 'Aliment pondeuse', 'depense')]
    const txs = [
      tx({ produit_id: 'p-oeufs', prix_unitaire: 2300, quantite: 30 }),
      tx({ produit_id: 'p-poulet', prix_unitaire: 3000, quantite: 7 }),
      tx({ type: 'depense', produit_id: 'p-alim', prix_unitaire: 15000, quantite: 4 }),
    ]
    const r = parProduit(txs, produits, 'vente')
    expect(r.map((l) => [l.produit.nom, l.montant, l.quantite])).toEqual([['Œufs', 69000, 30], ['Poulets frais', 21000, 7]])
    expect(r[0].part).toBeCloseTo(69000 / 90000, 5)
  })
})

describe('classementClients', () => {
  it('trie les clients par chiffre d’affaires décroissant', () => {
    const clients = [client('sidi', 'Sidi'), client('kha', 'Khadija')]
    const txs = [tx({ client_id: 'sidi', montant: 300000 }), tx({ client_id: 'kha', montant: 600000 }), tx({ client_id: 'kha', type: 'depense', montant: 1 })]
    expect(classementClients(txs, clients).map((l) => [l.client.nom, l.ca, l.nb])).toEqual([['Khadija', 600000, 1], ['Sidi', 300000, 1]])
  })
})

describe('Trésorerie du mois', () => {
  it('compte l’argent payé, pas le montant des ventes à crédit, plus les paiements du mois', async () => {
    const { tresorerieMois } = await import('../../../src/lib/calculs/bilans')
    const t = (id: string, type: 'vente' | 'depense', date: string, montant: number, montant_paye: number) =>
      ({ id, type, date, client_id: null, produit_id: 'p', quantite: 1, prix_unitaire: montant, montant, montant_paye })
    const txs = [t('v1', 'vente', '2026-10-05', 100000, 40000), t('d1', 'depense', '2026-10-06', 50000, 0), t('v0', 'vente', '2026-09-30', 9000, 9000)]
    const paiements = [
      { id: 'p1', client_id: 'c', date: '2026-10-10', montant: 25000, mode: 'wave' as const },
      { id: 'p2', client_id: 'f', sens: 'fournisseur' as const, date: '2026-10-12', montant: 30000, mode: 'especes' as const },
    ]
    expect(tresorerieMois(txs, paiements, '2026-10')).toEqual({ entre: 65000, sorti: 30000 })
  })
})

describe('marge brute', () => {
  const produits = [produit('a', 'Aliment pondeuse', 'depense'), produit('v', 'Vaccins', 'depense'), produit('s', 'Salaires', 'depense'), produit('o', 'Œufs', 'vente')]
  it('reconnaît d’office les coûts directs par leur nom, sauf réglage', () => {
    expect(produitsDirects(produits)).toEqual(['a', 'v'])
    expect(produitsDirects(produits, ['s'])).toEqual(['s'])
    expect(produitsDirects(produits, [])).toEqual([])
  })
  it('retire des ventes du mois les seuls coûts directs du mois', () => {
    const txs = [
      tx({ date: '2026-10-02', prix_unitaire: 1000 }),
      tx({ date: '2026-10-03', type: 'depense', produit_id: 'a', prix_unitaire: 300 }),
      tx({ date: '2026-10-04', type: 'depense', produit_id: 's', prix_unitaire: 500 }),
      tx({ date: '2026-09-30', type: 'depense', produit_id: 'a', prix_unitaire: 900 }),
      tx({ date: '2026-10-05', type: 'depense', produit_id: 'a', prix_unitaire: 100, supprime_le: '2026-10-06' }),
    ]
    expect(margeBruteMois(txs, '2026-10', ['a'])).toEqual({ couts: 300, marge: 700, taux: 0.7 })
    expect(margeBruteMois([], '2026-10', ['a'])).toEqual({ couts: 0, marge: 0, taux: null })
  })
})
