import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Fournisseurs } from '../../src/ui/pages/Fournisseurs'
import { FournisseurFiche } from '../../src/ui/pages/FournisseurFiche'
import { DonneesFixes } from '../../src/data/useDonnees'
import { client, paiement, produit, tx } from '../fixtures/tx'

const esp = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T10:00:00'))
})
afterEach(() => vi.useRealTimers())

function afficher(chemin: string) {
  const dep = (id: string, date: string, f: string, montant: number, paye = 0) =>
    tx({ id, date, type: 'depense', client_id: f, produit_id: 'p-alim', prix_unitaire: montant, montant_paye: paye })
  const donnees = {
    clients: [client('f-sow', 'Aliment Sow'), client('f-sen', 'Senelec'), client('c-dame', 'Dame')],
    produits: [produit('p-alim', 'Aliment pondeuse', 'depense')],
    transactions: [dep('d1', '2026-09-01', 'f-sow', 300000, 100000), dep('d2', '2026-10-21', 'f-sen', 20000), dep('d3', '2026-10-01', 'f-sen', 5000, 5000)],
    paiements: [paiement({ id: 'pc', client_id: 'f-sen', montant: 999, sens: 'client' })],
  }
  const enregistrer = vi.fn(async (_t: string, l: Record<string, unknown>) => (l.id as string) ?? 'x')
  render(
    <DonneesFixes donnees={donnees} actions={{ enregistrer }}>
      <MemoryRouter initialEntries={[chemin]}>
        <Routes>
          <Route path="/fournisseurs" element={<Fournisseurs />} />
          <Route path="/fournisseurs/:id" element={<FournisseurFiche />} />
        </Routes>
      </MemoryRouter>
    </DonneesFixes>,
  )
  return { enregistrer, u: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) }
}

describe('Fournisseurs et dettes', () => {
  it('liste les dettes du plus gros montant au plus petit, avec leur ancienneté et le total', () => {
    afficher('/fournisseurs')
    const zone = screen.getByRole('region', { name: 'Dettes' })
    expect(within(zone).getAllByRole('link').map((l) => esp(l.textContent))).toEqual([
      'Aliment Sowdepuis 60 jours200 000 F', 'Senelecdepuis 10 jours20 000 F',
    ])
    expect(esp(screen.getByTestId('total-a-payer').textContent)).toBe('220 000 F')
  })

  it('montre la fiche et enregistre un paiement au fournisseur après récapitulatif', async () => {
    const { u, enregistrer } = afficher('/fournisseurs/f-sow')
    expect(screen.getByRole('heading', { name: 'Aliment Sow' })).toBeInTheDocument()
    expect(esp(screen.getByTestId('du').textContent)).toBe('200 000 F')
    expect(screen.getByText('depuis 60 jours')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Enregistrer un paiement' }))
    await u.type(screen.getByLabelText('Montant'), '150000')
    await u.click(screen.getByRole('button', { name: 'Continuer' }))
    const recap = screen.getByRole('region', { name: 'Récapitulatif' })
    expect(esp(recap.textContent)).toContain('Reste à payer50 000 F')
    await u.click(within(recap).getByRole('button', { name: 'Valider' }))
    expect(enregistrer).toHaveBeenCalledWith('paiements', expect.objectContaining({ client_id: 'f-sow', montant: 150000, sens: 'fournisseur' }))
  })
})
