import { joursEntre } from '../format'
import type { Client, DateISO, Paiement, Transaction } from '../types'

const estPaiementFournisseur = (p: Paiement) => !p.supprime_le && p.sens === 'fournisseur'

/**
 * Dette envers un fournisseur : reste à payer des dépenses moins les paiements faits ensuite.
 * Les paiements soldent d'abord les dettes les plus anciennes ; `depuis` est la date de la plus ancienne encore due.
 */
export function detteFournisseur(fournisseurId: string, txs: Transaction[], paiements: Paiement[], ref: DateISO) {
  const dettes = txs
    .filter((t) => t.type === 'depense' && t.client_id === fournisseurId && !t.supprime_le && t.montant > t.montant_paye)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({ date: t.date, reste: t.montant - t.montant_paye }))
  let disponible = paiements.filter((p) => p.client_id === fournisseurId && estPaiementFournisseur(p)).reduce((s, p) => s + p.montant, 0)
  for (const d of dettes) {
    const impute = Math.min(d.reste, disponible)
    d.reste -= impute
    disponible -= impute
  }
  const restantes = dettes.filter((d) => d.reste > 0)
  const du = restantes.reduce((s, d) => s + d.reste, 0)
  const depuis = restantes[0]?.date ?? null
  return { du, depuis, jours: depuis ? joursEntre(depuis, ref) : null }
}

export type LigneDette = { fournisseur: Client; du: number; depuis: DateISO | null; jours: number | null }

export function dettesFournisseurs(fournisseurs: Client[], txs: Transaction[], paiements: Paiement[], ref: DateISO) {
  const lignes: LigneDette[] = fournisseurs
    .filter((f) => !f.supprime_le)
    .map((fournisseur) => ({ fournisseur, ...detteFournisseur(fournisseur.id, txs, paiements, ref) }))
    .filter((l) => l.du > 0)
    .sort((a, b) => b.du - a.du)
  return { lignes, total: lignes.reduce((s, l) => s + l.du, 0) }
}

/** Argent réellement sorti sur la période (préfixe AAAA-MM, AAAA ou '' pour tout) : comptant des dépenses + paiements fournisseurs. */
export function argentSorti(txs: Transaction[], paiements: Paiement[], periode: string): number {
  const comptant = txs.filter((t) => t.type === 'depense' && !t.supprime_le && t.date.startsWith(periode)).reduce((s, t) => s + t.montant_paye, 0)
  const verses = paiements.filter((p) => estPaiementFournisseur(p) && p.date.startsWith(periode)).reduce((s, p) => s + p.montant, 0)
  return comptant + verses
}

/** Reste à payer des dépenses saisies sans fournisseur (aliment acheté « à payer plus tard »…). */
export function resteSansFournisseur(txs: Transaction[]): number {
  return txs.filter((t) => t.type === 'depense' && !t.client_id && !t.supprime_le).reduce((s, t) => s + Math.max(0, t.montant - t.montant_paye), 0)
}
