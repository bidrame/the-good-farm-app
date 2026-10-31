import { soldeClient, soldesClients, validerTransaction, dernierPrix } from '../../../src/lib/calculs/credits'
import { tx, paiement, client } from '../../fixtures/tx'

const esp = (s?: string) => s?.replace(/\s/g, ' ')

describe('validerTransaction', () => {
  const ok = { type: 'vente' as const, date: '2026-10-31', client_id: 'c1', produit_id: 'p', prix_unitaire: 2600, quantite: 20, montant: 52000, montant_paye: 52000 }
  it('accepte une vente complète', () => {
    expect(validerTransaction(ok, '2026-10-31')).toEqual({})
  })
  it('refuse un paiement supérieur au montant', () => {
    expect(esp(validerTransaction({ ...ok, montant_paye: 60000 }, '2026-10-31').montant_paye)).toBe('Le montant payé ne peut pas dépasser 52 000 F')
  })
  it('refuse un paiement négatif', () => {
    expect(validerTransaction({ ...ok, montant_paye: -1 }, '2026-10-31').montant_paye).toBe('Montant payé invalide')
  })
  it('refuse une date dans le futur', () => {
    expect(validerTransaction({ ...ok, date: '2026-11-01' }, '2026-10-31').date).toBe('Date dans le futur')
  })
  it('exige quantité, prix, produit et client pour une vente', () => {
    const e = validerTransaction({ type: 'vente', date: '2026-10-31', quantite: 0 }, '2026-10-31')
    expect(e.quantite).toBe('Quantité obligatoire')
    expect(e.prix_unitaire).toBe('Prix obligatoire')
    expect(e.produit_id).toBe('Produit obligatoire')
    expect(e.client_id).toBe('Client obligatoire')
  })
  it("n'exige pas de fournisseur pour une dépense payée", () => {
    expect(validerTransaction({ ...ok, type: 'depense', client_id: null, montant_paye: 52000 }, '2026-10-31')).toEqual({})
  })
})

describe('soldeClient', () => {
  it('additionne les restes à payer moins les paiements', () => {
    expect(soldeClient('c1', [tx({ prix_unitaire: 52000, montant_paye: 30000 })], [paiement({ montant: 10000 })])).toBe(12000)
  })
  it('donne une avance (négatif) quand le client a trop payé', () => {
    expect(soldeClient('c1', [], [paiement({ montant: 5000 })])).toBe(-5000)
  })
  it('ignore les dépenses, les autres clients et les lignes supprimées', () => {
    const txs = [
      tx({ type: 'depense', prix_unitaire: 9000 }),
      tx({ client_id: 'c2', prix_unitaire: 9000, montant_paye: 0 }),
      tx({ prix_unitaire: 9000, montant_paye: 0, supprime_le: '2026-10-31' }),
    ]
    expect(soldeClient('c1', txs, [paiement({ montant: 1000, supprime_le: '2026-10-31' })])).toBe(0)
  })
})

describe('soldesClients', () => {
  it('liste les clients avec un solde, du plus endetté au moins endetté', () => {
    const clients = [client('c1', 'Dame'), client('c2', 'Ass'), client('c3', 'Nafi')]
    const txs = [tx({ client_id: 'c1', prix_unitaire: 5000, montant_paye: 0 }), tx({ client_id: 'c2', prix_unitaire: 22000, montant_paye: 0 })]
    expect(soldesClients(clients, txs, []).map((s) => [s.client.nom, s.solde])).toEqual([['Ass', 22000], ['Dame', 5000]])
  })
})

describe('dernierPrix', () => {
  it('reprend le prix de la vente la plus récente pour ce client et ce produit', () => {
    const txs = [
      tx({ date: '2026-10-01', prix_unitaire: 2300 }),
      tx({ date: '2026-10-20', prix_unitaire: 2600 }),
      tx({ date: '2026-10-25', prix_unitaire: 9999, client_id: 'c2' }),
    ]
    expect(dernierPrix(txs, 'c1', 'p-oeufs')).toBe(2600)
    expect(dernierPrix(txs, 'c3', 'p-oeufs')).toBeNull()
  })
  it('distingue le prix d’un plateau de 30 et d’une boîte de 12', () => {
    const txs = [tx({ date: '2026-10-01', prix_unitaire: 2300 }), tx({ date: '2026-10-02', prix_unitaire: 1000, oeufs_par_unite: 12 })]
    expect(dernierPrix(txs, 'c1', 'p-oeufs', 30)).toBe(2300)
    expect(dernierPrix(txs, 'c1', 'p-oeufs', 12)).toBe(1000)
    expect(dernierPrix(txs, 'c1', 'p-oeufs', 6)).toBeNull()
  })
})
