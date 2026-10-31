import type { Client, Paiement, Produit, Transaction } from '../../src/lib/types'

let n = 0
export const tx = (p: Partial<Transaction>): Transaction => {
  const t: Transaction = {
    id: `t${++n}`, date: '2026-10-31', type: 'vente', client_id: 'c1', produit_id: 'p-oeufs',
    prix_unitaire: 0, quantite: 1, montant: 0, montant_paye: 0, ...p,
  }
  if (p.montant === undefined) t.montant = t.prix_unitaire * t.quantite
  if (p.montant_paye === undefined) t.montant_paye = t.type === 'vente' ? t.montant : 0
  return t
}

export const paiement = (p: Partial<Paiement>): Paiement => ({
  id: `p${++n}`, client_id: 'c1', date: '2026-10-31', montant: 0, mode: 'especes', ...p,
})

export const client = (id: string, nom: string): Client => ({ id, nom })

export const produit = (id: string, nom: string, type: Produit['type'] = 'vente'): Produit => ({ id, nom, type, unite: 'plaque', actif: true })
