import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Ponte } from '../../src/ui/pages/Ponte'
import { DonneesFixes } from '../../src/data/useDonnees'
import { BANDES, ponte } from '../fixtures/bandes'
import type { Ponte as TPonte } from '../../src/lib/types'

const bandes = BANDES.map((b) => (b.id === 'b4' ? { ...b, effectif_initial: 572 } : b))

function afficher(pontes: TPonte[] = []) {
  const enregistrer = vi.fn(async (_t: string, l: Record<string, unknown>) => (l.id as string) ?? 'x')
  render(
    <DonneesFixes donnees={{ bandes, ponte: pontes }} actions={{ enregistrer }}>
      <Ponte />
    </DonneesFixes>,
  )
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-31' } })
  return { enregistrer, u: userEvent.setup() }
}

const carte = (nom: string) => screen.getByRole('group', { name: nom })

describe('Ponte du jour', () => {
  it('affiche une carte par box en production', () => {
    afficher()
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['BANDE 3', 'BANDE 4', 'BANDE 5', 'BANDE 6'])
  })

  it('calcule le taux en direct et le colore', async () => {
    const { u } = afficher()
    const c = carte('BANDE 4')
    await u.type(within(c).getByLabelText('Plaques'), '16')
    await u.type(within(c).getByLabelText('+ œufs'), '24')
    const taux = within(c).getByTestId('taux')
    expect(taux).toHaveTextContent('88 %')
    expect(taux).toHaveClass('ok')
  })

  it('colore en rouge une ponte très en dessous de l’attendu', async () => {
    const { u } = afficher()
    const c = carte('BANDE 4')
    await u.type(within(c).getByLabelText('Plaques'), '5')
    expect(within(c).getByTestId('taux')).toHaveClass('mauvais')
  })

  it('enregistre seulement les bandes saisies, en nombre d’œufs', async () => {
    const { u, enregistrer } = afficher()
    const c = carte('BANDE 4')
    await u.type(within(c).getByLabelText('Plaques'), '16')
    await u.type(within(c).getByLabelText('+ œufs'), '24')
    await u.type(within(c).getByLabelText('Perdus'), '6')
    await u.type(within(c).getByLabelText('Morts'), '1')
    await u.type(within(c).getByLabelText('Aliment (kg)'), '65')
    await u.click(screen.getByRole('button', { name: 'Enregistrer tout' }))
    expect(enregistrer).toHaveBeenCalledTimes(1)
    expect(enregistrer).toHaveBeenCalledWith('ponte', expect.objectContaining({
      bande_id: 'b4', date: '2026-10-31', oeufs_collectes: 504, oeufs_perdus: 6, mortalite: 1, aliment_kg: 65,
    }))
    expect(screen.getByText(/Enregistré/)).toBeInTheDocument()
  })

  it('reprend une ponte déjà saisie et la met à jour', async () => {
    const { u, enregistrer } = afficher([ponte('b4', '2026-10-31', { id: 'existante', oeufs_collectes: 504 })])
    const c = carte('BANDE 4')
    expect(within(c).getByLabelText('Plaques')).toHaveValue('16')
    expect(within(c).getByLabelText('+ œufs')).toHaveValue('24')
    await u.clear(within(c).getByLabelText('+ œufs'))
    await u.type(within(c).getByLabelText('+ œufs'), '25')
    await u.click(screen.getByRole('button', { name: 'Enregistrer tout' }))
    expect(enregistrer).toHaveBeenCalledWith('ponte', expect.objectContaining({ id: 'existante', oeufs_collectes: 505 }))
  })

  it('demande confirmation quand il y a plus d’œufs que de poules', async () => {
    const { u, enregistrer } = afficher()
    await u.type(within(carte('BANDE 4')).getByLabelText('Plaques'), '24')
    await u.click(screen.getByRole('button', { name: 'Enregistrer tout' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Plus d’œufs que de poules')
    expect(enregistrer).not.toHaveBeenCalled()
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Enregistrer quand même' }))
    expect(enregistrer).toHaveBeenCalledTimes(1)
  })

  it('permet de saisir un jour passé', () => {
    afficher([ponte('b4', '2026-10-30', { oeufs_collectes: 300 })])
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-30' } })
    expect(within(carte('BANDE 4')).getByLabelText('Plaques')).toHaveValue('10')
  })
})

describe('Ponte : robustesse', () => {
  it('réenregistre la même ligne quand on corrige après un premier enregistrement', async () => {
    const { u, enregistrer } = afficher()
    const c = carte('BANDE 4')
    await u.type(within(c).getByLabelText('Plaques'), '16')
    await u.click(screen.getByRole('button', { name: 'Enregistrer tout' }))
    await u.type(within(c).getByLabelText('+ œufs'), '3')
    await u.click(screen.getByRole('button', { name: 'Enregistrer tout' }))
    const ids = enregistrer.mock.calls.map((c) => (c[1] as { id: string }).id)
    expect(ids).toHaveLength(2)
    expect(ids[1]).toBe(ids[0])
  })

  it('reprend l’id d’une ponte du jour arrivée de l’autre téléphone', async () => {
    const enregistrer = vi.fn(async (_t: string, l: Record<string, unknown>) => (l.id as string) ?? 'x')
    const vue = (pontes: TPonte[]) => (
      <DonneesFixes donnees={{ bandes, ponte: pontes }} actions={{ enregistrer }}><Ponte /></DonneesFixes>
    )
    const { rerender } = render(vue([]))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-31' } })
    rerender(vue([ponte('b4', '2026-10-31', { id: 'du-conjoint', oeufs_collectes: 500 })]))
    const u = userEvent.setup()
    await u.type(within(carte('BANDE 3')).getByLabelText('Plaques'), '10')
    await u.click(screen.getByRole('button', { name: 'Enregistrer tout' }))
    expect(enregistrer).not.toHaveBeenCalledWith('ponte', expect.objectContaining({ bande_id: 'b4' }))
  })

  it('ne plante pas quand les bandes arrivent après l’ouverture de l’écran', () => {
    const { rerender } = render(<DonneesFixes donnees={{ bandes: [], ponte: [] }}><Ponte /></DonneesFixes>)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-31' } })
    rerender(<DonneesFixes donnees={{ bandes, ponte: [] }}><Ponte /></DonneesFixes>)
    expect(screen.getAllByRole('group')).toHaveLength(4)
  })

  it('bloque le bouton pendant l’enregistrement (pas de double envoi)', async () => {
    const enregistrer = vi.fn(() => new Promise<string>(() => {}))
    render(<DonneesFixes donnees={{ bandes, ponte: [] }} actions={{ enregistrer }}><Ponte /></DonneesFixes>)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-31' } })
    const u = userEvent.setup()
    await u.type(within(carte('BANDE 4')).getByLabelText('Plaques'), '16')
    await u.click(screen.getByRole('button', { name: /Enregistrer tout|Enregistrement/ }))
    await act(async () => {})
    await u.click(screen.getByRole('button', { name: /Enregistrer tout|Enregistrement/ }))
    expect(enregistrer).toHaveBeenCalledTimes(1)
  })
})
