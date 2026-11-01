import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Accueil } from '../../src/ui/pages/Accueil'
import { DonneesFixes } from '../../src/data/useDonnees'
import { ferme } from '../fixtures/ferme'
import { ponte } from '../fixtures/bandes'
import { tx } from '../fixtures/tx'

const esp = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ')

function afficher(heure = 10, enAttente = 0, stock?: { date: string; oeufs: number }, extra: ReturnType<typeof tx>[] = []) {
  vi.setSystemTime(new Date(`2026-10-31T${String(heure).padStart(2, '0')}:00:00`))
  const d = ferme()
  d.transactions!.push(tx({ id: 'sept', date: '2026-09-15', client_id: 'c-dame', prix_unitaire: 50000 }))
  d.transactions!.push(tx({ id: 'sept-dep', date: '2026-09-15', type: 'depense', client_id: null, produit_id: 'p-alim', prix_unitaire: 40000 }))
  d.ponte = [ponte('b4', '2026-10-30', { oeufs_collectes: 520 })]
  d.transactions!.push(...extra)
  if (stock) d.reglages = [{ id: 1, stock_depart: stock }]
  render(
    <DonneesFixes donnees={d} enAttente={enAttente}>
      <MemoryRouter><Accueil /></MemoryRouter>
    </DonneesFixes>,
  )
}

const carte = (libelle: string) => screen.getByText(libelle).closest('.metrique')!

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }))
afterEach(() => vi.useRealTimers())

describe('Accueil', () => {
  it('montre une perte en rouge et dit si les montants montent ou baissent', () => {
    afficher(10, 0, undefined, [tx({ id: 'grosse-dep', date: '2026-10-20', type: 'depense', client_id: null, produit_id: 'p-alim', prix_unitaire: 200000 })])
    expect(screen.getByTestId('resultat').closest('.vedette')).toHaveClass('vedette-perte')
    expect(esp(carte('Ventes').textContent)).toContain('▲ 59 % de plus')
  })

  it('garde le bandeau vert quand le mois est gagnant', () => {
    afficher()
    expect(screen.getByTestId('resultat').closest('.vedette')).not.toHaveClass('vedette-perte')
  })

  it('résume le mois en cours avec la variation', () => {
    afficher()
    expect(esp(carte('Ventes').textContent)).toContain('79 500 F')
    expect(esp(carte('Ventes').textContent)).toContain('▲ 59 %')
    expect(esp(carte('Dépenses').textContent)).toContain('60 000 F')
    expect(carte('Dépenses').querySelector('.mauvais')).toHaveTextContent('▲') // des dépenses en hausse, c'est en rouge
    expect(esp(screen.getByTestId('resultat').textContent)).toContain('19 500 F')
    expect(esp(screen.getByText(/par rapport à septembre/).textContent)).toBe('▲ +9 500 F par rapport à septembre')
    expect(esp(carte('Crédits dus').textContent)).toContain('11 000 F')
  })

  it('sous le résultat, montre l’argent réellement entré et sorti et ce qu’il reste à payer', () => {
    afficher()
    const ligne = screen.getByLabelText('Trésorerie du mois')
    expect(ligne).toHaveTextContent(/Argent réellement entré : .+ · sorti : .+ · encore à payer aux fournisseurs : /)
  })
  it('range les alertes : une cloche avec leur nombre et un seul bandeau, la plus grave d’abord', () => {
    afficher(19)
    const cloche = screen.getByRole('link', { name: /^Alertes : \d+ à voir$/ })
    expect(cloche).toHaveAttribute('href', '/alertes')
    expect(cloche.querySelector('.pastille-nombre')).toHaveClass('danger')
    const bandeau = screen.getByRole('link', { name: 'Voir les alertes' })
    expect(bandeau).toHaveTextContent(/Ponte du jour pas encore saisie.* · et \d+ autres →/)
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('« Vu » sur le bandeau range l’alerte et montre la suivante', async () => {
    localStorage.clear()
    afficher(19)
    const avant = screen.getByRole('link', { name: 'Voir les alertes' }).textContent
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: 'Marquer cette alerte comme vue' }))
    expect(screen.getByRole('link', { name: 'Voir les alertes' }).textContent).not.toBe(avant)
    expect(screen.getByRole('link', { name: 'Voir les alertes' })).not.toHaveTextContent('Ponte du jour pas encore saisie')
    localStorage.clear()
  })

  it('n’a plus de raccourcis (doublon du menu du bas) et met le stock avant le résultat du mois', () => {
    afficher(10, 0, { date: '2026-10-29', oeufs: 820 })
    expect(screen.queryByRole('navigation', { name: 'Raccourcis' })).toBeNull()
    const stock = carte('Stock d’œufs au magasin')
    const resultat = screen.getByTestId('resultat')
    expect(stock.compareDocumentPosition(resultat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('n’affiche plus la ponte d’hier : le détail est dans la page Stock', () => {
    afficher()
    expect(screen.queryByRole('region', { name: 'Ponte d’hier' })).toBeNull()
  })

  it('les cartes Ventes et Dépenses ouvrent la saisie', () => {
    afficher()
    expect(screen.getByRole('link', { name: 'Saisir une vente' })).toHaveAttribute('href', '/saisir')
    expect(screen.getByRole('link', { name: 'Saisir une dépense' })).toHaveAttribute('href', '/saisir?type=depense')
  })

  it('la carte du stock ouvre la page Stock', () => {
    afficher(10, 0, { date: '2026-10-29', oeufs: 820 })
    expect(carte('Stock d’œufs au magasin').closest('a')).toHaveAttribute('href', '/stock')
  })

  it('détaille le stock du magasin par calibre', () => {
    vi.setSystemTime(new Date('2026-10-31T10:00:00'))
    const d = ferme()
    d.ponte = []
    d.reglages = [{ id: 1, stock_depart: { date: '2026-10-29', oeufs: 1200, par_calibre: { gros: 900, petit: 300 } },
      boxes: [1, 2, 3, 4].map((numero) => ({ numero, ouvrier_id: null })) }]
    d.transactions = []
    render(<DonneesFixes donnees={d}><MemoryRouter><Accueil /></MemoryRouter></DonneesFixes>)
    expect(screen.getByLabelText('Stock par calibre')).toHaveTextContent('Gros 30Petit 10')
  })

  it('montre le stock d’œufs en plateaux', () => {
    afficher(10, 0, { date: '2026-10-29', oeufs: 300 })
    expect(esp(carte('Stock d’œufs au magasin').textContent)).toContain('27 plateaux + 10')
  })

  it('invite à faire l’inventaire quand le stock n’est pas encore connu', () => {
    afficher()
    expect(screen.getByRole('link', { name: /Faire l’inventaire/ })).toHaveAttribute('href', '/reglages')
  })

  it('montre ce qu’il reste à payer aux fournisseurs et alerte sur une dette ancienne', () => {
    vi.setSystemTime(new Date('2026-10-31T10:00:00'))
    const d = ferme()
    d.clients!.push({ id: 'f-sow', nom: 'Aliment Sow' })
    d.transactions!.push(tx({ id: 'dette', date: '2026-09-01', type: 'depense', client_id: 'f-sow', produit_id: 'p-alim', prix_unitaire: 80000, montant_paye: 0 }))
    render(<DonneesFixes donnees={d}><MemoryRouter><Accueil /></MemoryRouter></DonneesFixes>)
    expect(esp(carte('À payer').textContent)).toContain('80 000 F')
  })

  it('ne répète pas le bandeau d’attente, déjà affiché en haut de chaque écran', () => {
    afficher(10, 2)
    expect(screen.queryByText(/En attente d’envoi/)).toBeNull()
  })
})

describe('Accueil sans alerte', () => {
  it('encourage quand tout va bien', () => {
    vi.setSystemTime(new Date('2026-10-31T10:00:00'))
    const d = ferme()
    d.bandes = []
    d.reglages = [{ id: 1, derniere_sauvegarde: '2026-10-30' }]
    render(<DonneesFixes donnees={d}><MemoryRouter><Accueil /></MemoryRouter></DonneesFixes>)
    expect(screen.getByText('Tout va bien aujourd’hui ✓')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Alertes' }).querySelector('.pastille-nombre')).toBeNull()
  })
})
