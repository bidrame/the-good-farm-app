import type { Donnees } from '../../src/data/useDonnees'
import { BANDES } from './bandes'
import { client, produit, tx } from './tx'

/** Petit jeu de données réaliste pour les tests d'écrans. */
export function ferme(): Partial<Donnees> {
  const produits = [
    produit('p-oeufs', 'Œufs'),
    produit('p-pf', 'Poulets frais'),
    produit('p-pc', 'Poulets congelés'),
    produit('p-pp', 'Poulets sur pieds'),
    produit('p-autre-v', 'Autres'),
    produit('p-alim', 'Aliment pondeuse', 'depense'),
    produit('p-sal', 'Salaires', 'depense'),
  ]
  const clients = [client('c-aba', 'ABABACAR'), client('c-bab', 'Babacar'), client('c-dame', 'Dame'), client('c-ass', 'Ass')]
  const transactions = [
    tx({ id: 't1', date: '2026-10-01', client_id: 'c-bab', produit_id: 'p-oeufs', prix_unitaire: 2300, quantite: 10 }),
    tx({ id: 't2', date: '2026-10-20', client_id: 'c-bab', produit_id: 'p-oeufs', prix_unitaire: 2600, quantite: 10 }),
    tx({ id: 't3', date: '2026-10-21', client_id: 'c-dame', produit_id: 'p-oeufs', prix_unitaire: 2200, quantite: 5, montant_paye: 0 }),
    tx({ id: 't4', date: '2026-10-22', client_id: 'c-dame', produit_id: 'p-pf', prix_unitaire: 3000, quantite: 2 }),
    tx({ id: 't5', date: '2026-10-22', client_id: 'c-ass', produit_id: 'p-pc', prix_unitaire: 2500, quantite: 4 }),
    tx({ id: 't6', date: '2026-10-23', client_id: 'c-ass', produit_id: 'p-pp', prix_unitaire: 3500, quantite: 1 }),
    tx({ id: 't7', date: '2026-10-25', type: 'depense', client_id: null, produit_id: 'p-alim', prix_unitaire: 15000, quantite: 4 }),
  ]
  return { produits, clients, transactions, bandes: BANDES, ponte: [], paiements: [] }
}
