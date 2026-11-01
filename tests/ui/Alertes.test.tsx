import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Alertes } from '../../src/ui/pages/Alertes'
import { DonneesFixes, type Donnees } from '../../src/data/useDonnees'
import { ferme } from '../fixtures/ferme'
import { ponte } from '../fixtures/bandes'
import { tx } from '../fixtures/tx'

const esp = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ')

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T19:00:00'))
})
afterEach(() => vi.useRealTimers())

function afficher(modif: (d: Partial<Donnees>) => void = () => {}) {
  const d = ferme()
  d.ponte = [ponte('b4', '2026-10-30', { oeufs_collectes: 520 })]
  modif(d)
  render(<DonneesFixes donnees={d}><MemoryRouter><Alertes /></MemoryRouter></DonneesFixes>)
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

describe('Page Alertes', () => {
  it('trie par gravité, chaque alerte avec son action directe', () => {
    afficher((d) => {
      d.clients!.push({ id: 'f-sow', nom: 'Aliment Sow' })
      d.transactions!.push(tx({ id: 'dette', date: '2026-09-01', type: 'depense', client_id: 'f-sow', produit_id: 'p-alim', prix_unitaire: 80000, montant_paye: 0 }))
    })
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Urgent', 'À surveiller', 'Info'])
    const urgent = screen.getByRole('region', { name: 'Urgent' })
    expect(urgent).toHaveTextContent('Ponte du jour pas encore saisie')
    expect(within(urgent).getByRole('link', { name: 'Saisir la ponte' })).toHaveAttribute('href', '/ponte')
    const dette = within(screen.getByRole('region', { name: 'À surveiller' })).getAllByRole('article').find((a) => esp(a.textContent).includes('Aliment Sow : 80 000 F à payer depuis 60 jours'))!
    expect(within(dette).getByRole('link', { name: 'Voir la dette' })).toHaveAttribute('href', '/fournisseurs')
    expect(within(screen.getByRole('region', { name: 'Info' })).getByRole('link', { name: 'Exporter' })).toHaveAttribute('href', '/export')
  })

  it('« Vu » range l’alerte en bas, en gris, et « Remettre » la ramène', async () => {
    const u = afficher()
    const urgent = screen.getByRole('region', { name: 'Urgent' })
    await u.click(within(urgent).getByRole('button', { name: 'Vu' }))
    expect(screen.queryByRole('region', { name: 'Urgent' })).toBeNull()
    const vues = screen.getByRole('region', { name: 'Déjà vues' })
    expect(vues).toHaveTextContent('Ponte du jour pas encore saisie')
    expect(JSON.parse(localStorage.getItem('alertes-vues')!)).toHaveLength(1)
    await u.click(within(vues).getByRole('button', { name: 'Remettre' }))
    expect(screen.getByRole('region', { name: 'Urgent' })).toBeInTheDocument()
  })

  it('une alerte vue revient quand la situation change', () => {
    localStorage.setItem('alertes-vues', JSON.stringify(['ponte_non_saisie||Ponte du jour pas encore saisie (BANDE 3)']))
    afficher()
    expect(screen.getByRole('region', { name: 'Urgent' })).toHaveTextContent('Ponte du jour pas encore saisie')
  })

  it('rappelle de recompter les bandes dont la ponte contredit l’effectif noté', () => {
    afficher((d) => { d.bandes = d.bandes!.map((b) => (b.id === 'b4' ? { ...b, effectif_initial: 100 } : b)) })
    const art = screen.getAllByRole('article').find((a) => a.textContent?.includes('Effectif à vérifier'))!
    expect(art).toHaveTextContent('BANDE 4')
    expect(within(art).getByRole('link', { name: 'Recompter' })).toHaveAttribute('href', '/bandes/b4')
  })

  it('ne parle pas d’effectif quand la ponte est cohérente', () => {
    afficher()
    expect(screen.queryByText(/Effectif à vérifier/)).toBeNull()
  })

  it('sans alerte : tout va bien', () => {
    vi.setSystemTime(new Date('2026-10-31T10:00:00'))
    afficher((d) => { d.bandes = []; d.reglages = [{ id: 1, derniere_sauvegarde: '2026-10-30' }] })
    expect(screen.getByText('Tout va bien aujourd’hui ✓')).toBeInTheDocument()
  })
})
