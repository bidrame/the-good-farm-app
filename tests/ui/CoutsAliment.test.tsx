import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Couts } from '../../src/ui/pages/Couts'
import { Aliment } from '../../src/ui/pages/Aliment'
import { Alertes } from '../../src/ui/pages/Alertes'
import { DonneesFixes, type Donnees } from '../../src/data/useDonnees'
import { produit, tx } from '../fixtures/tx'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T10:00:00'))
})
afterEach(() => vi.useRealTimers())

const produits = [produit('p-oeufs', 'Œufs'), produit('p-alim', 'Aliment pondeuse', 'depense'), produit('p-sal', 'Salaires', 'depense'), produit('p-chair', 'Aliment chair', 'depense')]
const dep = (id: string, date: string, produit_id: string, montant: number, quantite = 1) =>
  tx({ id, date, type: 'depense', client_id: null, produit_id, prix_unitaire: montant / quantite, quantite, montant_paye: montant })
const vente = (id: string, date: string, plateaux: number, prix: number) => tx({ id, date, client_id: 'c', produit_id: 'p-oeufs', quantite: plateaux, prix_unitaire: prix, oeufs_par_unite: 30 })

function afficher(page: JSX.Element, d: Partial<Donnees>) {
  const enregistrer = vi.fn(async () => 'x')
  render(<DonneesFixes donnees={{ produits, reglages: [{ id: 1, derniere_sauvegarde: '2026-10-30' }], ...d }} actions={{ enregistrer }}><MemoryRouter>{page}</MemoryRouter></DonneesFixes>)
  return { enregistrer, u: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) }
}

describe('Prix de revient', () => {
  const txs = [
    dep('a9', '2026-09-03', 'p-alim', 860000, 50), dep('s9', '2026-09-30', 'p-sal', 140000), dep('c9', '2026-09-10', 'p-chair', 500000), vente('v9', '2026-09-15', 1000, 2100),
    dep('a10', '2026-10-03', 'p-alim', 1200000, 70), vente('v10', '2026-10-15', 1000, 2000),
  ]
  it('donne le coût moyen d’un plateau, le prix de vente et la marge', () => {
    afficher(<Couts />, { transactions: txs })
    expect(screen.getByRole('region', { name: 'Sur 3 mois' })).toHaveTextContent(/un plateau vous coûte\s*1\s100 F.*vendu 2\s050 F en moyenne · marge \+950 F par plateau/)
  })
  it('détaille chaque mois par poste, sans les dépenses des poulets de chair', async () => {
    const { u } = afficher(<Couts />, { transactions: txs })
    const sept = screen.getByText('septembre 2026').closest('details')!
    expect(sept).toHaveTextContent(/\+1\s100 F \(52 %\)/)
    await u.click(within(sept).getByText('septembre 2026'))
    expect(sept).toHaveTextContent(/Aliment pondeuse860 F/)
    expect(sept).not.toHaveTextContent('Aliment chair')
    expect(sept).toHaveTextContent('plateaux vendus : la ponte n’était pas saisie tous les jours')
  })
  it('laisse choisir ce qui compte dans le prix de revient', async () => {
    const { u, enregistrer } = afficher(<Couts />, { transactions: txs })
    await u.click(screen.getByRole('checkbox', { name: 'Salaires' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, couts_exclus: ['p-chair', 'p-sal'] })
  })
})

describe('Aliment', () => {
  const livraisons = [dep('l1', '2026-09-10', 'p-alim', 17200 * 600, 600), dep('l2', '2026-10-20', 'p-alim', 17200 * 600, 600)]
  it('sans comptage, invite à compter les sacs et montre la consommation', () => {
    afficher(<Aliment />, { transactions: livraisons })
    expect(screen.getByText(/Comptez une fois les sacs/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Consommation' })).toHaveTextContent('≈ 1000 kg / jour')
    expect(screen.getByRole('region', { name: 'Consommation' })).toHaveTextContent('≈ 20,0 sacs / jour')
  })
  it('enregistre le comptage des sacs', async () => {
    const { u, enregistrer } = afficher(<Aliment />, { transactions: livraisons })
    await u.type(screen.getByLabelText('Sacs pleins'), '120')
    await u.click(screen.getByRole('button', { name: 'Enregistrer le comptage' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, aliment: { stock: { date: '2026-10-31', sacs: 120 } } })
  })
  it('après un comptage, donne les sacs et les jours restants, et prévient avant la rupture', () => {
    const reglages = [{ id: 1, derniere_sauvegarde: '2026-10-30', aliment: { stock: { date: '2026-10-28', sacs: 80 } } }]
    afficher(<><Aliment /><Alertes /></>, { transactions: livraisons, reglages })
    // 80 sacs = 4 000 kg, moins 2 jours à 1 000 kg = 2 000 kg : 40 sacs, 2 jours.
    expect(screen.getByRole('region', { name: 'Stock d’aliment' })).toHaveTextContent(/Il reste environ\s*40 sacs≈ 2 jours d’aliment : pensez à commander/)
    const urgent = screen.getByRole('region', { name: 'Urgent' })
    expect(urgent).toHaveTextContent('Aliment : il reste environ 40 sacs, soit 2 jours. Pensez à commander.')
    expect(within(urgent).getByRole('link', { name: 'Voir l’aliment' })).toHaveAttribute('href', '/aliment')
  })
})
