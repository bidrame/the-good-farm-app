import type { Transaction } from '../types'

/** Clé de comparaison des noms : minuscules, sans accents, espaces réduits. */
export function cleNom(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function estDoublonTransaction(t: Transaction, existantes: Transaction[]): boolean {
  return existantes.some(
    (e) =>
      e.id !== t.id && !e.supprime_le && e.date === t.date && e.type === t.type &&
      e.client_id === t.client_id && e.produit_id === t.produit_id && e.montant === t.montant,
  )
}
