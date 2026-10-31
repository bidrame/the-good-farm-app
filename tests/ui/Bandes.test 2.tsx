import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Bandes } from '../../src/ui/pages/Bandes'
import { BandeFiche } from '../../src/ui/pages/BandeFiche'
import { DonneesFixes } from '../../src/data/useDonnees'
import { BANDES, ponte } from '../fixtures/bandes'
import type { Bande } from '../../src/lib/types'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T10:00:00'))
})
afterEach(() => vi.useRealTimers())

function afficher(chemin: string, bandes: Bande[] = BANDES) {
  const enregistrer = vi.fn(async (_t: string, l: Record<string, unknown>) => (l.id as string) ?? 'x')
  const pontes = [ponte('b4', '2026-10-30', { oeufs_collectes: 520, mortalite: 3 }), ponte('b4', '2026-10-29', { oeufs_collectes: 500 })]
  render(
    <DonneesFixes donnees={{ bandes, ponte: pontes }} actions={{ enregistrer }}>
      <MemoryRouter initialEntries={[chemin]}>
        <Routes>
          <Route path="/bandes" element={<Bandes />} />
          <Route path="/bandes/:id" element={<BandeFiche />} />
        </Routes>
      </MemoryRouter>
    </DonneesFixes>,
  )
  return { enregistrer, u: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) }
}

describe('Liste des bandes', () => {
  it('montre âge, phase, effectif et taux moyen des bandes actives', () => {
    afficher('/bandes')
    const ligne = screen.getByRole('link', { name: /BANDE 4/ })
    expect(ligne).toHaveTextContent('box 2')
    expect(ligne).toHaveTextContent('63 sem.')
    expect(ligne).toHaveTextContent('Ponte')
    expect(ligne).toHaveTextContent('647 poules')
    expect(ligne).toHaveTextContent('78 %') // (520/650 + 500/650) / 2 = 78,5 → 78
    expect(screen.getByRole('link', { name: /BANDE 3/ })).toHaveTextContent('Fin de cycle')
  })
  it('range les bandes réformées à part', () => {
    afficher('/bandes')
    const reformees = screen.getByRole('region', { name: 'Bandes réformées' })
    expect(within(reformees).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringContaining('BANDE 1'), expect.stringContaining('BANDE 2')])
  })
  it('indique qu’aucun box n’est libre', async () => {
    const { u } = afficher('/bandes')
    await u.click(screen.getByRole('button', { name: 'Nouvelle bande' }))
    expect(screen.getByText(/Aucun box libre/)).toBeInTheDocument()
  })
  it('crée une bande dans un box libre', async () => {
    const { u, enregistrer } = afficher('/bandes', BANDES.filter((b) => b.id !== 'b6'))
    await u.click(screen.getByRole('button', { name: 'Nouvelle bande' }))
    const box = screen.getByLabelText('Box') as HTMLSelectElement
    expect([...box.options].map((o) => o.value)).toEqual(['4'])
    await u.type(screen.getByLabelText('Nom'), 'BANDE 7')
    await u.type(screen.getByLabelText('Date de naissance'), '2026-10-01')
    await u.type(screen.getByLabelText('Effectif initial'), '650')
    await u.click(screen.getByRole('button', { name: 'Créer la bande' }))
    expect(enregistrer).toHaveBeenCalledWith('bandes', expect.objectContaining({ nom: 'BANDE 7', box: 4, date_naissance: '2026-10-01', effectif_initial: 650, date_reforme: null }))
  })
})

describe('Fiche bande', () => {
  it('affiche les chiffres clés et réforme la bande', async () => {
    const { u, enregistrer } = afficher('/bandes/b4')
    expect(screen.getByRole('heading', { name: /BANDE 4/ })).toBeInTheDocument()
    expect(screen.getByText('Mortalité cumulée').nextSibling).toHaveTextContent('3')
    expect(screen.getByTestId('courbe')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Réformer' }))
    await u.type(screen.getByLabelText('Date de réforme'), '2026-10-31')
    await u.click(screen.getByRole('button', { name: 'Confirmer la réforme' }))
    expect(enregistrer).toHaveBeenCalledWith('bandes', expect.objectContaining({ id: 'b4', date_reforme: '2026-10-31' }))
  })
})

describe('Modifier une bande', () => {
  it('corrige l’effectif et la date de réforme d’une bande réformée', async () => {
    const { u, enregistrer } = afficher('/bandes/b2')
    await u.click(screen.getByRole('button', { name: 'Modifier' }))
    const f = screen.getByRole('form', { name: 'Modifier la bande' })
    await u.clear(within(f).getByLabelText('Date de réforme'))
    await u.type(within(f).getByLabelText('Date de réforme'), '2026-04-10')
    await u.clear(within(f).getByLabelText('Effectif initial'))
    await u.type(within(f).getByLabelText('Effectif initial'), '655')
    await u.click(within(f).getByRole('button', { name: 'Enregistrer' }))
    expect(enregistrer).toHaveBeenCalledWith('bandes', expect.objectContaining({ id: 'b2', date_reforme: '2026-04-10', effectif_initial: 655 }))
  })
})
