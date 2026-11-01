import type { Client, Paiement, Produit, Transaction, TypeTx } from '../types'

export type LigneBilan = { periode: string; ventes: number; depenses: number; resultat: number; cumul: number }

function bilan(txs: Transaction[], cle: (t: Transaction) => string): LigneBilan[] {
  const parPeriode = new Map<string, { ventes: number; depenses: number }>()
  for (const t of txs) {
    if (t.supprime_le) continue
    const l = parPeriode.get(cle(t)) ?? { ventes: 0, depenses: 0 }
    if (t.type === 'vente') l.ventes += t.montant
    else l.depenses += t.montant
    parPeriode.set(cle(t), l)
  }
  let cumul = 0
  return [...parPeriode.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periode, { ventes, depenses }]) => {
      cumul += ventes - depenses
      return { periode, ventes, depenses, resultat: ventes - depenses, cumul }
    })
}

export const bilanMensuel = (txs: Transaction[]) => bilan(txs, (t) => t.date.slice(0, 7))
export const bilanAnnuel = (txs: Transaction[]) => bilan(txs, (t) => t.date.slice(0, 4))

/**
 * Argent réellement entré et sorti pendant le mois `AAAA-MM` : la part payée des ventes et dépenses du mois,
 * plus les paiements de crédits clients et de dettes fournisseurs datés du mois.
 */
export function tresorerieMois(txs: Transaction[], paiements: Paiement[], mois: string): { entre: number; sorti: number } {
  const duMois = <T extends { date: string; supprime_le?: string | null }>(l: T[]) => l.filter((x) => !x.supprime_le && x.date.startsWith(mois))
  const t = duMois(txs)
  const p = duMois(paiements)
  const somme = (l: number[]) => l.reduce((s, n) => s + n, 0)
  return {
    entre: somme(t.filter((x) => x.type === 'vente').map((x) => x.montant_paye)) + somme(p.filter((x) => x.sens !== 'fournisseur').map((x) => x.montant)),
    sorti: somme(t.filter((x) => x.type === 'depense').map((x) => x.montant_paye)) + somme(p.filter((x) => x.sens === 'fournisseur').map((x) => x.montant)),
  }
}

export function parProduit(txs: Transaction[], produits: Produit[], type: TypeTx) {
  const actives = txs.filter((t) => t.type === type && !t.supprime_le)
  const total = actives.reduce((s, t) => s + t.montant, 0)
  return produits
    .map((produit) => {
      const lignes = actives.filter((t) => t.produit_id === produit.id)
      const montant = lignes.reduce((s, t) => s + t.montant, 0)
      return { produit, montant, quantite: lignes.reduce((s, t) => s + t.quantite, 0), part: total ? montant / total : 0 }
    })
    .filter((l) => l.montant > 0)
    .sort((a, b) => b.montant - a.montant)
}

export function classementClients(txs: Transaction[], clients: Client[]) {
  const ventes = txs.filter((t) => t.type === 'vente' && !t.supprime_le)
  const total = ventes.reduce((s, t) => s + t.montant, 0)
  return clients
    .map((client) => {
      const lignes = ventes.filter((t) => t.client_id === client.id)
      const ca = lignes.reduce((s, t) => s + t.montant, 0)
      return { client, ca, nb: lignes.length, part: total ? ca / total : 0 }
    })
    .filter((l) => l.nb > 0)
    .sort((a, b) => b.ca - a.ca)
}
