import { detteFournisseur, dettesFournisseurs, argentSorti, resteSansFournisseur } from '../../../src/lib/calculs/dettes'
import { soldeClient, validerTransaction } from '../../../src/lib/calculs/credits'
import { calculerAlertes } from '../../../src/lib/calculs/alertes'
import { client, paiement, tx } from '../../fixtures/tx'

const dep = (date: string, montant: number, paye = 0, f = 'f1') =>
  tx({ date, type: 'depense', client_id: f, produit_id: 'p-alim', prix_unitaire: montant, montant_paye: paye })

describe('validerTransaction (dépense)', () => {
  const base = { type: 'depense' as const, date: '2026-10-31', produit_id: 'p', prix_unitaire: 1000, quantite: 1, montant: 1000 }
  it('exige un fournisseur quand tout n’est pas payé', () => {
    expect(validerTransaction({ ...base, client_id: null, montant_paye: 0 }, '2026-10-31').client_id).toBe('Fournisseur obligatoire si tout n’est pas payé')
    expect(validerTransaction({ ...base, client_id: null, montant_paye: 1000 }, '2026-10-31')).toEqual({})
  })
  it('exige toujours un fournisseur pour l’aliment, même payé', () => {
    expect(validerTransaction({ ...base, client_id: null, montant_paye: 1000 }, '2026-10-31', { aliment: true }).client_id).toBe('Fournisseur obligatoire pour l’aliment')
    expect(validerTransaction({ ...base, client_id: 'f1', montant_paye: 1000 }, '2026-10-31', { aliment: true })).toEqual({})
  })
  it('refuse de payer plus que le montant', () => {
    expect(validerTransaction({ ...base, client_id: 'f1', montant_paye: 2000 }, '2026-10-31').montant_paye).toMatch(/ne peut pas dépasser/)
  })
})

describe('detteFournisseur', () => {
  it('impute les paiements sur les dettes les plus anciennes et donne l’ancienneté restante', () => {
    const txs = [dep('2026-09-01', 100000), dep('2026-10-01', 50000, 10000), dep('2026-10-20', 30000)]
    const paies = [paiement({ client_id: 'f1', sens: 'fournisseur', montant: 120000, date: '2026-10-25' })]
    const d = detteFournisseur('f1', txs, paies, '2026-10-31')
    expect(d.du).toBe(170000 - 120000)
    // 100 000 (01/09) soldé, 40 000 (01/10) : 20 000 restants → la plus ancienne dette date du 01/10
    expect(d.depuis).toBe('2026-10-01')
    expect(d.jours).toBe(30)
  })
  it('ignore les paiements clients et les ventes', () => {
    const txs = [dep('2026-10-01', 50000), tx({ client_id: 'f1', prix_unitaire: 9999, montant_paye: 0 })]
    const paies = [paiement({ client_id: 'f1', montant: 50000 })]
    expect(detteFournisseur('f1', txs, paies, '2026-10-31').du).toBe(50000)
  })
  it('ne donne pas d’ancienneté quand tout est payé', () => {
    expect(detteFournisseur('f1', [dep('2026-10-01', 5000, 5000)], [], '2026-10-31')).toEqual({ du: 0, depuis: null, jours: null })
  })
})

describe('soldeClient', () => {
  it('ne compte pas les paiements faits à un fournisseur', () => {
    const paies = [paiement({ client_id: 'c1', montant: 5000, sens: 'fournisseur' })]
    expect(soldeClient('c1', [tx({ prix_unitaire: 8000, montant_paye: 0 })], paies)).toBe(8000)
  })
})

describe('dettesFournisseurs', () => {
  it('liste les fournisseurs à payer, du plus gros montant au plus petit, avec le total', () => {
    const fournisseurs = [client('f1', 'Senelec'), client('f2', 'Aliment Sow')]
    const txs = [dep('2026-10-01', 20000, 0, 'f1'), dep('2026-09-01', 300000, 100000, 'f2')]
    const r = dettesFournisseurs(fournisseurs, txs, [], '2026-10-31')
    expect(r.lignes.map((l) => [l.fournisseur.nom, l.du, l.jours])).toEqual([['Aliment Sow', 200000, 60], ['Senelec', 20000, 30]])
    expect(r.total).toBe(220000)
  })
})

describe('argentSorti', () => {
  it('compte ce qui est payé à la date du paiement : comptant des dépenses + paiements fournisseurs', () => {
    const txs = [dep('2026-10-05', 100000, 40000), dep('2026-09-30', 50000, 50000)]
    const paies = [paiement({ client_id: 'f1', sens: 'fournisseur', montant: 60000, date: '2026-10-20' }), paiement({ client_id: 'c1', montant: 7000, date: '2026-10-21' })]
    expect(argentSorti(txs, paies, '2026-10')).toBe(100000)
    expect(argentSorti(txs, paies, '2026-09')).toBe(50000)
    expect(argentSorti(txs, paies, '')).toBe(150000)
  })
})

describe('alerte de dette ancienne', () => {
  it('signale une dette fournisseur plus ancienne que le seuil réglé', () => {
    const base = { ref: '2026-10-31', heure: 10, bandes: [], pontes: [], derniereSauvegarde: '2026-10-31' }
    const fournisseurs = [client('f1', 'Senelec')]
    const txs = [dep('2026-09-15', 20000)]
    const a = calculerAlertes({ ...base, dettes: dettesFournisseurs(fournisseurs, txs, [], '2026-10-31').lignes })
    expect(a.map((x) => [x.code, x.message.replace(/\s/g, ' ')])).toEqual([['dette_ancienne', 'Senelec : 20 000 F à payer depuis 46 jours']])
    expect(calculerAlertes({ ...base, dettes: dettesFournisseurs(fournisseurs, txs, [], '2026-10-31').lignes, seuils: { jours_dette: 60 } })).toEqual([])
  })
})

describe('resteSansFournisseur', () => {
  it('additionne le reste à payer des dépenses sans fournisseur, sans les supprimées', () => {
    const txs = [
      tx({ type: 'depense', client_id: null, prix_unitaire: 60000 }),
      tx({ type: 'depense', client_id: null, prix_unitaire: 10000, montant_paye: 4000 }),
      tx({ type: 'depense', client_id: 'f1', prix_unitaire: 5000 }),
      tx({ type: 'depense', client_id: null, prix_unitaire: 9000, supprime_le: '2026-10-30' }),
      tx({ client_id: null, prix_unitaire: 1000, montant_paye: 0 }),
    ]
    expect(resteSansFournisseur(txs)).toBe(66000)
  })
})
