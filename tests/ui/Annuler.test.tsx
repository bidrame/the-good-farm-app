import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BandeFiche } from '../../src/ui/pages/BandeFiche'
import { Reglages } from '../../src/ui/pages/Reglages'
import { DonneesFixes, type Donnees } from '../../src/data/useDonnees'
import { BANDES } from '../fixtures/bandes'

function afficher(chemin: string, donnees: Partial<Donnees>) {
  const actions = {
    enregistrer: vi.fn(async (_t: string, l: Record<string, unknown>) => (l.id as string) ?? 'x'),
    supprimer: vi.fn(async () => {}),
    restaurer: vi.fn(async () => {}),
  }
  render(
    <DonneesFixes donnees={{ bandes: BANDES, ...donnees }} actions={actions}>
      <MemoryRouter initialEntries={[chemin]}>
        <Routes>
          <Route path="/bandes/:id" element={<BandeFiche />} />
          <Route path="/reglages" element={<Reglages />} />
        </Routes>
      </MemoryRouter>
    </DonneesFixes>,
  )
  return { ...actions, u: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T10:00:00'))
})
afterEach(() => vi.useRealTimers())

describe('Annuler après une suppression', () => {
  it('rend les morts supprimées en un toucher', async () => {
    const { u, supprimer, restaurer } = afficher('/bandes/b4', { mortalites: [{ id: 'm1', bande_id: 'b4', date: '2026-10-25', nombre: 10 }] })
    await u.click(screen.getByRole('button', { name: 'Supprimer les morts du 25/10/2026' }))
    expect(supprimer).toHaveBeenCalledWith('mortalites', 'm1')
    await u.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(restaurer).toHaveBeenCalledWith('mortalites', 'm1')
  })

  it('réactive un ouvrier désactivé par erreur', async () => {
    const o = { id: 'o1', nom: 'FALLOU', actif: true }
    const { u, enregistrer } = afficher('/reglages', { ouvriers: [o] })
    await u.click(screen.getByRole('button', { name: 'Désactiver FALLOU' }))
    expect(screen.getByRole('status')).toHaveTextContent('FALLOU désactivé')
    await u.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(enregistrer).toHaveBeenLastCalledWith('ouvriers', { ...o, actif: true })
  })

  it('disparaît au bout de 5 secondes', async () => {
    const { u } = afficher('/reglages', { ouvriers: [{ id: 'o1', nom: 'FALLOU', actif: true }] })
    await u.click(screen.getByRole('button', { name: 'Désactiver FALLOU' }))
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument()
    await act(() => new Promise((r) => setTimeout(r, 5100)))
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull()
  }, 8000)
})
