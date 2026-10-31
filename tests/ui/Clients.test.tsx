import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Clients } from '../../src/ui/pages/Clients'
import { ClientFiche } from '../../src/ui/pages/ClientFiche'
import { DonneesFixes } from '../../src/data/useDonnees'
import { ferme } from '../fixtures/ferme'
import { paiement, tx } from '../fixtures/tx'

const esp = (s: string | null) => (s ?? '').replace(/\s/g, ' ')

function afficher(chemin: string) {
  const d = ferme()
  d.transactions!.push(tx({ id: 'credit-ass', client_id: 'c-ass', produit_id: 'p-oeufs', prix_unitaire: 22000, montant_paye: 0 }))
  d.paiements = [paiement({ id: 'avance', client_id: 'c-aba', montant: 5000 })]
  d.clients![2] = { ...d.clients![2], telephone: '771234567' }
  const enregistrer = vi.fn(async (_t: string, l: Record<string, unknown>) => (l.id as string) ?? 'x')
  render(
    <DonneesFixes donnees={d} actions={{ enregistrer }}>
      <MemoryRouter initialEntries={[chemin]}>
        <Routes>
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientFiche />} />
        </Routes>
      </MemoryRouter>
    </DonneesFixes>,
  )
  return { enregistrer, u: userEvent.setup() }
}

describe('Clients et crédits', () => {
  it('trie les soldes du plus dû au moins dû, avances en dernier', () => {
    afficher('/clients')
    const zone = screen.getByRole('region', { name: 'Soldes' })
    const lignes = within(zone).getAllByRole('link').map((l) => esp(l.textContent))
    expect(lignes).toEqual(['Ass22 000 F', 'Dame11 000 F', 'ABABACARAvance de 5 000 F'])
    expect(esp(screen.getByTestId('total-du').textContent)).toBe('33 000 F')
  })

  it('montre la fiche client et enregistre un paiement', async () => {
    const { u, enregistrer } = afficher('/clients/c-dame')
    expect(screen.getByRole('heading', { name: 'Dame' })).toBeInTheDocument()
    expect(esp(screen.getByTestId('solde').textContent)).toBe('11 000 F')
    await u.click(screen.getByRole('button', { name: 'Enregistrer un paiement' }))
    await u.type(screen.getByLabelText('Montant'), '10000')
    await u.selectOptions(screen.getByLabelText('Mode'), 'wave')
    await u.click(screen.getByRole('button', { name: 'Valider le paiement' }))
    expect(enregistrer).toHaveBeenCalledWith('paiements', expect.objectContaining({ client_id: 'c-dame', montant: 10000, mode: 'wave' }))
  })

  it('propose un rappel WhatsApp avec le solde', () => {
    afficher('/clients/c-dame')
    const lien = screen.getByRole('link', { name: 'Rappel WhatsApp' })
    expect(lien.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/221771234567\?text=Bonjour%20Dame/)
  })

  it('refuse un paiement vide', async () => {
    const { u, enregistrer } = afficher('/clients/c-dame')
    await u.click(screen.getByRole('button', { name: 'Enregistrer un paiement' }))
    await u.click(screen.getByRole('button', { name: 'Valider le paiement' }))
    expect(screen.getByText('Montant obligatoire')).toBeInTheDocument()
    expect(enregistrer).not.toHaveBeenCalled()
  })
})

describe('Paiement : robustesse', () => {
  it('n’enregistre qu’une fois en cas de double appui', async () => {
    const enregistrer = vi.fn(() => new Promise<string>(() => {}))
    render(
      <DonneesFixes donnees={ferme()} actions={{ enregistrer }}>
        <MemoryRouter initialEntries={['/clients/c-dame']}><Routes><Route path="/clients/:id" element={<ClientFiche />} /></Routes></MemoryRouter>
      </DonneesFixes>,
    )
    const u = userEvent.setup()
    await u.click(screen.getByRole('button', { name: 'Enregistrer un paiement' }))
    await u.type(screen.getByLabelText('Montant'), '1000')
    await u.click(screen.getByRole('button', { name: /Valider le paiement|Enregistrement/ }))
    await u.click(screen.getByRole('button', { name: /Valider le paiement|Enregistrement/ }))
    expect(enregistrer).toHaveBeenCalledTimes(1)
  })
})
