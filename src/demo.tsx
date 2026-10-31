import { useState } from 'react'
import { HashRouter } from 'react-router-dom'
import { DonneesFixes, DONNEES_VIDES, type Donnees } from './data/useDonnees'
import type { NomTable } from './data/fileAttente'
import { ajouterJours, aujourdhui } from './lib/format'
import { Pages } from './App'
import './ui/theme.css'

/** Données d'exemple (inventées) pour essayer l'appli sans Supabase : `npm run demo`. */
function donneesDemo(): Donnees {
  const ref = aujourdhui()
  const produits = [
    { id: 'p1', nom: 'Œufs', type: 'vente', unite: 'plaque', actif: true },
    { id: 'p2', nom: 'Poulets frais', type: 'vente', unite: 'unite', actif: true },
    { id: 'p3', nom: 'Poulets congelés', type: 'vente', unite: 'unite', actif: true },
    { id: 'p4', nom: 'Fumier', type: 'vente', unite: 'kg', actif: true },
    { id: 'p5', nom: 'Aliment pondeuse', type: 'depense', unite: 'unite', actif: true },
    { id: 'p6', nom: 'Salaires', type: 'depense', unite: 'forfait', actif: true },
    { id: 'p7', nom: 'Médicaments/Véto', type: 'depense', unite: 'unite', actif: true },
  ] as Donnees['produits']
  const clients = ['Babacar', 'Dame', 'Ass', 'Khadija', 'Nafi', 'Sidi'].map((nom, i) => ({ id: `c${i}`, nom }))
  const bandes: Donnees['bandes'] = [
    { id: 'b3', nom: 'BANDE 3', box: 1, ouvrier_id: null, date_naissance: ajouterJours(ref, -640), effectif_initial: 600, date_reforme: null },
    { id: 'b4', nom: 'BANDE 4', box: 2, ouvrier_id: null, date_naissance: ajouterJours(ref, -440), effectif_initial: 650, date_reforme: null },
    { id: 'b5', nom: 'BANDE 5', box: 3, ouvrier_id: null, date_naissance: ajouterJours(ref, -415), effectif_initial: 620, date_reforme: null },
    { id: 'b6', nom: 'BANDE 6', box: 4, ouvrier_id: null, date_naissance: ajouterJours(ref, -180), effectif_initial: 2600, date_reforme: null },
  ]
  const taux: Record<string, number> = { b3: 0.58, b4: 0.8, b5: 0.83, b6: 0.88 }
  const ponte: Donnees['ponte'] = []
  for (let j = 21; j >= 1; j--)
    for (const b of bandes) {
      const baisse = b.id === 'b5' && j <= 7 ? 0.12 : 0
      ponte.push({
        id: `${b.id}-${j}`, date: ajouterJours(ref, -j), bande_id: b.id,
        oeufs_collectes: Math.round(b.effectif_initial * (taux[b.id] - baisse + ((j * 7) % 5) / 100)),
        oeufs_perdus: j % 4, mortalite: j % 6 === 0 ? 1 : 0, aliment_kg: Math.round(b.effectif_initial * 0.115),
      })
    }
  const transactions: Donnees['transactions'] = []
  for (let j = 60; j >= 0; j--) {
    const c = clients[j % clients.length]
    const q = 10 + (j % 15)
    transactions.push({ id: `v${j}`, date: ajouterJours(ref, -j), type: 'vente', client_id: c.id, produit_id: 'p1', prix_unitaire: 2300, quantite: q, montant: q * 2300, montant_paye: j % 9 === 0 ? 0 : q * 2300 })
    if (j % 7 === 0) transactions.push({ id: `a${j}`, date: ajouterJours(ref, -j), type: 'depense', client_id: null, produit_id: 'p5', prix_unitaire: 15500, quantite: 20, montant: 310000, montant_paye: 0 })
    if (j % 30 === 0) transactions.push({ id: `s${j}`, date: ajouterJours(ref, -j), type: 'depense', client_id: null, produit_id: 'p6', prix_unitaire: 450000, quantite: 1, montant: 450000, montant_paye: 0 })
  }
  return { ...DONNEES_VIDES, produits, clients, bandes, ponte, transactions, profils: [{ id: 'demo', prenom: 'Démo' }], reglages: [{ id: 1, derniere_sauvegarde: ajouterJours(ref, -9), stock_depart: { date: ajouterJours(ref, -3), oeufs: 1500 } }] }
}

export function Demo() {
  const [d, setD] = useState(donneesDemo)
  const ecrire = (table: NomTable, f: (lignes: Record<string, unknown>[]) => Record<string, unknown>[]) =>
    setD((x) => ({ ...x, [table]: f(x[table as keyof Donnees] as unknown as Record<string, unknown>[]) }))
  return (
    <DonneesFixes
      donnees={d}
      actions={{
        enregistrer: async (table, ligne) => {
          const id = (ligne.id as string) ?? crypto.randomUUID()
          ecrire(table, (l) => [...l.filter((x) => x.id !== id), { cree_par: 'demo', ...ligne, id }])
          return id
        },
        supprimer: async (table, id) => ecrire(table, (l) => l.map((x) => (x.id === id ? { ...x, supprime_le: new Date().toISOString() } : x))),
        restaurer: async (table, id) => ecrire(table, (l) => l.map((x) => (x.id === id ? { ...x, supprime_le: null } : x))),
      }}
    >
      <HashRouter><Pages /></HashRouter>
    </DonneesFixes>
  )
}
