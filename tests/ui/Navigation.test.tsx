import { render, screen, within } from '@testing-library/react'
import { Coquille } from '../../src/App'
import { DonneesFixes } from '../../src/data/useDonnees'
import { ferme } from '../fixtures/ferme'

function ouvrir(chemin: string) {
  window.location.hash = `#${chemin}`
  render(<DonneesFixes donnees={ferme()}><Coquille session={{}} sansDonnees /></DonneesFixes>)
  return within(screen.getByRole('navigation', { name: 'Navigation principale' }))
}

afterEach(() => { window.location.hash = '' })

describe('Menu Plus', () => {
  it('range les pages en trois rubriques', () => {
    ouvrir('/plus')
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['La ferme', 'L’argent', 'Outils'])
  })
})

describe('Pages rangées dans « Plus »', () => {
  it('allume l’onglet Plus et propose un retour vers la page parente', () => {
    const nav = ouvrir('/clients/c-dame')
    expect(nav.getByRole('link', { name: 'Plus' })).toHaveClass('active')
    expect(nav.getByRole('link', { name: 'Accueil' })).not.toHaveClass('active')
    expect(screen.getByRole('link', { name: '← Clients' })).toHaveAttribute('href', '#/clients')
  })

  it('ramène à « Plus » depuis une page du menu', () => {
    const nav = ouvrir('/historique')
    expect(nav.getByRole('link', { name: 'Plus' })).toHaveClass('active')
    expect(screen.getByRole('link', { name: '← Plus' })).toHaveAttribute('href', '#/plus')
  })

  it('n’ajoute pas de retour sur les onglets principaux', () => {
    const nav = ouvrir('/ponte')
    expect(nav.getByRole('link', { name: 'Ponte' })).toHaveClass('active')
    expect(screen.queryByRole('link', { name: /^← / })).toBeNull()
  })
})
