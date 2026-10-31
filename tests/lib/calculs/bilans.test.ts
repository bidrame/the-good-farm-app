import { bilanMensuel, bilanAnnuel, parProduit, classementClients } from '../../../src/lib/calculs/bilans'
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
