import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Coquille } from '../../src/App'
import { DonneesFixes } from '../../src/data/useDonnees'
import type { Rejetee } from '../../src/data/fileAttente'
import { ferme } from '../fixtures/ferme'

function ouvrir(rejetees: Rejetee[]) {
  const abandonner = vi.fn(async () => {})
  window.location.hash = '#/'
  render(<DonneesFixes donnees={ferme()} rejetees={rejetees} actions={{ abandonner }}><Coquille session={{}} sansDonnees /></DonneesFixes>)
  return { abandonner, u: userEvent.setup() }
}

beforeEach(() => sessionStorage.clear())
afterEach(() => { window.location.hash = '' })

describe('Corriger une saisie refusée', () => {
  it('rouvre la vente, pré-remplie, dans Saisir', async () => {
    const ligne = { id: 't-ref', date: '2026-10-30', type: 'vente', client_id: 'c-dame', produit_id: 'p-oeufs', prix_unitaire: 2300, quantite: 12, montant: 27600, montant_paye: 10000, oeufs_par_unite: 30, calibre: null, observation: null }
    const { u, abandonner } = ouvrir([{ op: { id: 'upsert:transactions:t-ref', table: 'transactions', action: 'upsert', ligne }, erreur: 'violates check', le: '2026-10-30T10:00:00Z' }])
    await u.click(within(screen.getByRole('region', { name: 'Saisies refusées' })).getByRole('button', { name: 'Corriger' }))
    expect(abandonner).toHaveBeenCalledWith('upsert:transactions:t-ref')
    expect(window.location.hash).toBe('#/saisir')
    expect(screen.getByText('Dame')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantité')).toHaveValue('12')
    expect(screen.getByLabelText(/Prix/)).toHaveValue('2300')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-30')
    expect(screen.getByRole('button', { name: 'Une partie' })).toHaveClass('choisi')
  })

  it('rouvre la ponte du bon jour, pré-remplie', async () => {
    const ligne = { id: 'p-ref', date: '2026-10-30', bande_id: 'b4', oeufs_collectes: 510, oeufs_perdus: 3, mortalite: 1, aliment_kg: 70, observation: null }
    const { u, abandonner } = ouvrir([{ op: { id: 'upsert:ponte:p-ref', table: 'ponte', action: 'upsert', ligne }, erreur: 'duplicate key', le: '2026-10-30T10:00:00Z' }])
    await u.click(within(screen.getByRole('region', { name: 'Saisies refusées' })).getByRole('button', { name: 'Corriger' }))
    expect(abandonner).toHaveBeenCalledWith('upsert:ponte:p-ref')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-30')
    const carte = screen.getByRole('group', { name: 'BANDE 4' })
    expect(within(carte).getByTestId('oeufs')).toHaveTextContent('510 œufs')
  })

  it('ne propose pas de corriger ce qui n’a pas de formulaire', () => {
    ouvrir([{ op: { id: 'upsert:clients:c9', table: 'clients', action: 'upsert', ligne: { id: 'c9', nom: 'Fatou' } }, erreur: 'duplicate key', le: '2026-10-30T10:00:00Z' }])
    expect(within(screen.getByRole('region', { name: 'Saisies refusées' })).queryByRole('button', { name: 'Corriger' })).toBeNull()
  })
})
