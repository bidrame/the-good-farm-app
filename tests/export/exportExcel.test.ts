import * as XLSX from 'xlsx'
import { construireClasseur, nomFichier } from '../../src/export/exportExcel'
import { DONNEES_VIDES, type Donnees } from '../../src/data/useDonnees'
import { ferme } from '../fixtures/ferme'
import { paiement } from '../fixtures/tx'

function donnees(): Donnees {
  const d = { ...DONNEES_VIDES, ...ferme() } as Donnees
  d.transactions[5] = { ...d.transactions[5], supprime_le: '2026-10-30T10:00:00Z' }
  d.paiements = [paiement({ client_id: 'c-dame', montant: 5000, mode: 'wave', date: '2026-10-28' })]
  return d
}

/** Écrit puis relit le classeur, comme Excel le ferait. */
const relu = (wb: XLSX.WorkBook) => XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { cellDates: true })

describe('construireClasseur', () => {
  it('contient exactement les six onglets prévus', () => {
    expect(construireClasseur(donnees(), '2026-10-31').SheetNames).toEqual(['Transactions', 'Paiements', 'Crédits clients', 'Bandes', 'Ponte', 'Bilan mensuel'])
  })
  it('exporte les dépenses en négatif comme l’ancien classeur, sans les lignes supprimées', () => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(relu(construireClasseur(donnees(), '2026-10-31')).Sheets.Transactions)
    expect(rows).toHaveLength(6)
    const depense = rows.find((r) => r.Type === 'Dépense')!
    expect(depense.Montant).toBe(-60000)
    expect(depense.Produit).toBe('Aliment pondeuse')
    expect(rows.find((r) => r.Client === 'Dame' && r.Produit === 'Œufs')!.Reste).toBe(11000)
    expect(rows.find((r) => r.Client === 'Dame' && r.Produit === 'Œufs')!['Œufs par unité']).toBe(30)
    expect(depense['Œufs par unité']).toBeUndefined()
  })
  it('écrit de vraies dates Excel', () => {
    const ws = relu(construireClasseur(donnees(), '2026-10-31')).Sheets.Transactions
    const d = ws.A2.v as Date
    expect(d).toBeInstanceOf(Date)
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 10, 25])
  })
  it('donne les soldes clients après paiements', () => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(construireClasseur(donnees(), '2026-10-31').Sheets['Crédits clients'])
    expect(rows).toEqual([{ Client: 'Dame', Solde: 6000 }])
  })
})

describe('nomFichier', () => {
  it('date le fichier', () => {
    expect(nomFichier('2026-10-31')).toBe('TheGoodFarm_2026-10-31.xlsx')
  })
})
