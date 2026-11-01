import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Stock } from '../../src/ui/pages/Stock'
import { DonneesFixes, type Donnees } from '../../src/data/useDonnees'
import { BANDES, ponte } from '../fixtures/bandes'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-01T20:00:00'))
})
afterEach(() => vi.useRealTimers())

const produits = [{ id: 'p-oeufs', nom: 'Œufs', type: 'vente' as const, unite: 'plaque' as const, actif: true }]
const boxes = [{ numero: 1, ouvrier_id: null, calibre: 'gros' as const }, { numero: 2, ouvrier_id: null, calibre: 'gros' as const },
  { numero: 3, ouvrier_id: null, calibre: 'moyen' as const }, { numero: 4, ouvrier_id: null, calibre: 'petit' as const }]

function afficher(d: Partial<Donnees>) {
  render(<DonneesFixes donnees={{ bandes: BANDES, produits, ...d }}><MemoryRouter><Stock /></MemoryRouter></DonneesFixes>)
}

describe('Page Stock', () => {
  it('donne le stock du magasin par calibre, puis jour par jour les entrées par box et les sorties', () => {
    afficher({
      reglages: [{ id: 1, boxes, stock_depart: { date: '2026-10-31', oeufs: 12420, par_calibre: { gros: 5130, moyen: 3990, petit: 3300 } } }],
      ponte: [ponte('b3', '2026-11-01', { oeufs_collectes: 1080 }), ponte('b6', '2026-11-01', { oeufs_collectes: 1680, oeufs_perdus: 30 })],
      transactions: [{ id: 'v', date: '2026-11-01', type: 'vente', client_id: 'c', produit_id: 'p-oeufs', quantite: 100, prix_unitaire: 2000, montant: 200000, montant_paye: 0, oeufs_par_unite: 30, calibre: 'gros' }],
    })
    // 414 + 36 + 55 − 100 = 405 plateaux
    expect(screen.getByRole('region', { name: 'Au magasin' })).toHaveTextContent('405 plateaux')
    expect(screen.getByRole('region', { name: 'Au magasin' })).toHaveTextContent('Gros 107Moyen 133Petit 165')
    const jour = screen.getByRole('article', { name: 'Mouvements du 01/11/2026' })
    expect(jour).toHaveTextContent('+91 · −100 plateaux')
    expect(jour).toHaveTextContent('Box 1 Gros36 plateaux')
    expect(jour).toHaveTextContent('Box 4 Petit55 plateaux')
    expect(within(jour).getByText(/Livré · vendu/).parentElement).toHaveTextContent('Gros −100')
    expect(screen.getByRole('article', { name: 'Inventaire de départ' })).toHaveTextContent('Inventaire du 31/10/2026414 plateauxGros 171Moyen 133Petit 110')
  })

  it('sans inventaire, invite à en faire un', () => {
    afficher({ reglages: [{ id: 1 }] })
    expect(screen.getByRole('link', { name: 'Faire l’inventaire' })).toHaveAttribute('href', '/reglages')
  })
})
