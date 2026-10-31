import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Accueil } from '../../src/ui/pages/Accueil'
import { DonneesFixes } from '../../src/data/useDonnees'
import { ferme } from '../fixtures/ferme'
import { ponte } from '../fixtures/bandes'
import { tx } from '../fixtures/tx'

const esp = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ')

function afficher(heure = 10, enAttente = 0, stock?: { date: string; oeufs: number }) {
  vi.setSystemTime(new Date(`2026-10-31T${String(heure).padStart(2, '0')}:00:00`))
  const d = ferme()
  d.transactions!.push(tx({ id: 'sept', date: '2026-09-15', client_id: 'c-dame', prix_unitaire: 50000 }))
  d.transactions!.push(tx({ id: 'sept-dep', date: '2026-09-15', type: 'depense', client_id: null, produit_id: 'p-alim', prix_unitaire: 40000 }))
  d.ponte = [ponte('b4', '2026-10-30', { oeufs_collectes: 520 })]
  if (stock) d.reglages = [{ id: 1, stock_depart: stock }]
  render(
    <DonneesFixes donnees={d} enAttente={enAttente}>
      <MemoryRouter><Accueil /></MemoryRouter>
    </DonneesFixes>,
  )
}

const carte = (libelle: string) => screen.getByText(libelle).parentElement!

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }))
afterEach(() => vi.useRealTimers())

describe('Accueil', () => {
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

  it('montre la ponte d’hier par box et le total ferme', () => {
    afficher()
    const zone = screen.getByRole('region', { name: 'Ponte d’hier' })
    expect(esp(zone.textContent)).toContain('BANDE 4')
    expect(esp(zone.textContent)).toContain('80 %')
    expect(esp(zone.textContent)).toContain('17 plateaux + 10')
  })

  it('affiche les alertes, les plus graves d’abord', () => {
    afficher(19)
    const alertes = screen.getAllByRole('status').map((a) => a.textContent ?? '')
    expect(alertes[0]).toContain('Ponte du jour pas encore saisie')
    expect(alertes.some((a) => a.includes('BANDE 3 : 72 semaines atteintes'))).toBe(true)
    expect(alertes.at(-1)).toContain('sauvegarde')
  })

  it('propose trois raccourcis : vente, ponte, dépense', () => {
    afficher()
    const zone = screen.getByRole('navigation', { name: 'Raccourcis' })
    expect([...zone.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Vente', '/saisir'], ['Ponte', '/ponte'], ['Dépense', '/saisir?type=depense'],
    ])
  })

  it('montre le stock d’œufs en plateaux', () => {
    afficher(10, 0, { date: '2026-10-29', oeufs: 300 })
    expect(esp(carte('Stock d’œufs').textContent)).toContain('27 plateaux + 10')
  })

  it('invite à faire l’inventaire quand le stock n’est pas encore connu', () => {
    afficher()
    expect(screen.getByRole('link', { name: /Faire l’inventaire/ })).toHaveAttribute('href', '/reglages')
  })

  it('signale les saisies en attente d’envoi', () => {
    afficher(10, 2)
    expect(screen.getByText('En attente d’envoi (2)')).toBeInTheDocument()
  })
})
