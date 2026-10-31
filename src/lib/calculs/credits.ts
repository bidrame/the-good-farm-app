import { formatFCFA } from '../format'
import type { Client, DateISO, Paiement, Transaction } from '../types'

export function validerTransaction(t: Partial<Transaction>, ref: DateISO): Record<string, string> {
  const e: Record<string, string> = {}
  if (!t.date) e.date = 'Date obligatoire'
  else if (t.date > ref) e.date = 'Date dans le futur'
  if (!t.produit_id) e.produit_id = 'Produit obligatoire'
  if (t.type === 'vente' && !t.client_id) e.client_id = 'Client obligatoire'
  if (!t.quantite || t.quantite <= 0) e.quantite = 'Quantité obligatoire'
  if (!t.prix_unitaire || t.prix_unitaire <= 0) e.prix_unitaire = 'Prix obligatoire'
  const paye = t.montant_paye ?? 0
  if (paye < 0) e.montant_paye = 'Montant payé invalide'
  else if (t.type === 'vente' && t.montant != null && paye > t.montant)
    e.montant_paye = `Le montant payé ne peut pas dépasser ${formatFCFA(t.montant)}`
  return e
}

/** Positif : le client doit ; négatif : avance. */
export function soldeClient(clientId: string, txs: Transaction[], paiements: Paiement[]): number {
  const du = txs
    .filter((t) => t.type === 'vente' && t.client_id === clientId && !t.supprime_le)
    .reduce((s, t) => s + t.montant - t.montant_paye, 0)
  const paye = paiements.filter((p) => p.client_id === clientId && !p.supprime_le).reduce((s, p) => s + p.montant, 0)
  return du - paye
}

export function soldesClients(clients: Client[], txs: Transaction[], paiements: Paiement[]): { client: Client; solde: number }[] {
  return clients
    .filter((c) => !c.supprime_le)
    .map((client) => ({ client, solde: soldeClient(client.id, txs, paiements) }))
    .filter((s) => s.solde !== 0)
    .sort((a, b) => b.solde - a.solde)
}

export function dernierPrix(txs: Transaction[], clientId: string | null, produitId: string): number | null {
  const t = txs
    .filter((t) => !t.supprime_le && t.client_id === clientId && t.produit_id === produitId)
    .reduce<Transaction | null>((m, t) => (!m || t.date >= m.date ? t : m), null)
  return t ? t.prix_unitaire : null
}
