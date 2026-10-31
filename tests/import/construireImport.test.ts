import { construireImport, idStable, lireFusionsCsv } from '../../scripts/import/construireImport'
import type { Lu } from '../../scripts/import/lireClasseur'

const lu: Lu = {
  transactions: [
    { ligne: 2, date: '2026-10-01', type: 'vente', client: 'ABABACAR', produit: 'Œufs', prix_unitaire: 2300, quantite: 10, montant: 23000, observation: null },
    { ligne: 3, date: '2026-10-02', type: 'vente', client: 'ababacar', produit: 'Œufs', prix_unitaire: 2300, quantite: 1, montant: 2300, observation: null },
    { ligne: 4, date: '2026-10-03', type: 'depense', client: 'aliment', produit: 'Autres', prix_unitaire: 500, quantite: 1, montant: 500, observation: null },
    { ligne: 5, date: '2026-10-03', type: 'vente', client: null, produit: 'Autres', prix_unitaire: 100, quantite: 1, montant: 100, observation: 'x' },
  ],
  bandes: [{ nom: 'BANDE 3', box: 1, ouvrier: 'FALLOU', date_naissance: '2025-01-22', effectif_initial: 600, date_reforme: null, observations: null }],
  pontes: [{ date: '2026-05-04', bande: 'BANDE 3', oeufs_collectes: 0, oeufs_perdus: 0, mortalite: 2, aliment_kg: null, observation: null }],
  rejets: [],
}

describe('construireImport', () => {
  const fusions = lireFusionsCsv('action;nom;devient;raison\nfusionner;ababacar;ABABACAR;casse\nretirer;aliment;;pas un client\n')
  const imp = construireImport(lu, fusions)

  it('applique les fusions et retire les faux clients', () => {
    expect(imp.clients.map((c) => c.nom)).toEqual(['ABABACAR'])
    const aba = imp.clients[0].id
    expect(imp.transactions.map((t) => t.client_id)).toEqual([aba, aba, null, null])
  })
  it('crée un produit par couple (nom, type) avec l’unité plaque pour les œufs', () => {
    expect(imp.produits.map((p) => [p.nom, p.type, p.unite]).sort()).toEqual([['Autres', 'depense', 'unite'], ['Autres', 'vente', 'unite'], ['Œufs', 'vente', 'plaque']])
  })
  it('considère les anciennes ventes comme payées', () => {
    expect(imp.transactions.map((t) => t.montant_paye)).toEqual([23000, 2300, 0, 100])
  })
  it('relie bandes, ouvriers et ponte', () => {
    expect(imp.ouvriers.map((o) => o.nom)).toEqual(['FALLOU'])
    expect(imp.bandes[0].ouvrier_id).toBe(imp.ouvriers[0].id)
    expect(imp.ponte[0].bande_id).toBe(imp.bandes[0].id)
  })
  it('donne des identifiants stables (relancer l’import ne duplique rien)', () => {
    expect(construireImport(lu, fusions).transactions.map((t) => t.id)).toEqual(imp.transactions.map((t) => t.id))
    expect(idStable('a', 'b')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('refuse un fichier de fusions encore à vérifier', () => {
    expect(() => construireImport(lu, lireFusionsCsv('action;nom;devient;raison\na_verifier;ababcar;ABABACAR;une lettre\n'))).toThrow(/à vérifier/)
  })
})
