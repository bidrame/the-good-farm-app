import type { Donnees } from '../data/useDonnees'
import type { NomTable } from '../data/fileAttente'
import { formatFCFA } from '../lib/format'
import { MODES } from './pages/ClientFiche'

/** Une saisie quelconque (vente, dépense, paiement, ponte) mise à plat pour l'historique et la corbeille. */
export type LigneJournal = {
  table: NomTable
  id: string
  date: string
  genre: 'vente' | 'depense' | 'paiement' | 'ponte'
  titre: string
  detail: string
  client_id: string | null
  produit_id: string | null
  auteur: string
  supprime_le?: string | null
}

export function journal(d: Donnees): LigneJournal[] {
  const nom = <T extends { id: string; nom: string }>(liste: T[], id: string | null) => liste.find((x) => x.id === id)?.nom ?? ''
  const auteur = (uid?: string) => (uid ? d.profils.find((p) => p.id === uid)?.prenom ?? '?' : 'Import')
  return [
    ...d.transactions.map((t) => ({
      table: 'transactions' as const, id: t.id, date: t.date, genre: t.type, client_id: t.client_id, produit_id: t.produit_id,
      titre: `${nom(d.produits, t.produit_id)}${t.client_id ? ` · ${nom(d.clients, t.client_id)}` : ''}`,
      detail: `${t.quantite} × ${formatFCFA(t.prix_unitaire)} = ${formatFCFA(t.montant)}${t.type === 'vente' && t.montant_paye < t.montant ? ` (reste ${formatFCFA(t.montant - t.montant_paye)})` : ''}`,
      auteur: auteur(t.cree_par), supprime_le: t.supprime_le,
    })),
    ...d.paiements.map((p) => ({
      table: 'paiements' as const, id: p.id, date: p.date, genre: 'paiement' as const, client_id: p.client_id, produit_id: null,
      titre: `${p.sens === 'fournisseur' ? 'Paiement fournisseur' : 'Paiement'} · ${nom(d.clients, p.client_id)}`, detail: `${formatFCFA(p.montant)} (${MODES.find((m) => m[0] === p.mode)?.[1]})`,
      auteur: auteur(p.cree_par), supprime_le: p.supprime_le,
    })),
    ...d.ponte.map((p) => ({
      table: 'ponte' as const, id: p.id, date: p.date, genre: 'ponte' as const, client_id: null, produit_id: null,
      titre: `Ponte · ${nom(d.bandes, p.bande_id)}`, detail: `${p.oeufs_collectes} œufs, ${p.mortalite} morts`,
      auteur: auteur(p.cree_par), supprime_le: p.supprime_le,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))
}
