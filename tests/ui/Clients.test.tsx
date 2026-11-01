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
    await u.click(within(screen.getByRole('group', { name: 'Mode' })).getByRole('button', { name: 'Wave' }))
    await u.click(screen.getByRole('button', { name: 'Continuer' }))
    const recap = screen.getByRole('region', { name: 'Récapitulatif' })
    expect(esp(recap.textContent)).toContain('Wave')
    expect(esp(recap.textContent)).toContain('Nouveau solde1 000 F')
    expect(enregistrer).not.toHaveBeenCalled()
    await u.click(within(recap).getByRole('button', { name: 'Valider' }))
    expect(enregistrer).toHaveBeenCalledWith('paiements', expect.objectContaining({ client_id: 'c-dame', montant: 10000, mode: 'wave' }))
    expect(screen.getByText('Paiement enregistré')).toBeInTheDocument()
  })

  it('propose un rappel WhatsApp avec le solde', () => {
    afficher('/clients/c-dame')
    const lien = screen.getByRole('link', { name: 'Rappel WhatsApp' })
    expect(lien.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/221771234567\?text=Bonjour%20Dame/)
  })

  it('remplit tout le solde en un toucher', async () => {
    const { u, enregistrer } = afficher('/clients/c-dame')
    await u.click(screen.getByRole('button', { name: 'Enregistrer un paiement' }))
    await u.click(screen.getByRole('button', { name: /Tout le solde/ }))
    expect(screen.getByLabelText('Montant')).toHaveValue('11000')
    await u.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(esp(screen.getByRole('region', { name: 'Récapitulatif' }).textContent)).toContain('Nouveau solde0 F')
    expect(screen.getByRole('region', { name: 'Récapitulatif' })).toHaveTextContent('Espèces')
    expect(enregistrer).not.toHaveBeenCalled()
  })

  it('refuse un paiement vide', async () => {
    const { u, enregistrer } = afficher('/clients/c-dame')
    await u.click(screen.getByRole('button', { name: 'Enregistrer un paiement' }))
    await u.click(screen.getByRole('button', { name: 'Continuer' }))
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
    await u.click(screen.getByRole('button', { name: 'Continuer' }))
    await u.click(screen.getByRole('button', { name: /^Valider$|Enregistrement/ }))
    await u.click(screen.getByRole('button', { name: /^Valider$|Enregistrement/ }))
    expect(enregistrer).toHaveBeenCalledTimes(1)
  })
})

describe('Paiement plus grand que la dette', () => {
  it('prévient que le client sera en avance', async () => {
    const { u } = afficher('/clients/c-dame')
    await u.click(screen.getByRole('button', { name: 'Enregistrer un paiement' }))
    await u.type(screen.getByLabelText('Montant'), '15000')
    await u.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(esp(screen.getByRole('region', { name: 'Récapitulatif' }).textContent)).toContain('Avance de 4 000 F')
  })
})

describe('Nouveau client', () => {
  afterEach(() => { delete (navigator as unknown as { contacts?: unknown }).contacts })

  it('crée un client avec son téléphone et ouvre sa fiche', async () => {
    const { u, enregistrer } = afficher('/clients')
    await u.click(screen.getByRole('button', { name: 'Nouveau client' }))
    const f = screen.getByRole('form', { name: 'Nouveau client' })
    expect(within(f).queryByRole('button', { name: 'Choisir dans mes contacts' })).toBeNull() // pas de carnet d'adresses ici
    await u.type(within(f).getByLabelText('Nom'), 'Mame Diarra')
    await u.type(within(f).getByLabelText('Téléphone'), '77 555 44 33')
    await u.click(within(f).getByRole('button', { name: 'Enregistrer' }))
    expect(enregistrer).toHaveBeenCalledWith('clients', expect.objectContaining({ nom: 'Mame Diarra', telephone: '77 555 44 33', notes: null }))
    expect(screen.getByText(/introuvable/)).toBeInTheDocument() // on est passé sur /clients/<id> (fiche vide ici : enregistrement simulé)
  })

  it('remplit nom et numéro depuis les contacts du téléphone', async () => {
    Object.defineProperty(navigator, 'contacts', {
      configurable: true, value: { select: vi.fn(async () => [{ name: ['Moussa Commerçant'], tel: ['+221 77 000 11 22'] }]) },
    })
    const { u } = afficher('/clients')
    await u.click(screen.getByRole('button', { name: 'Nouveau client' }))
    const f = screen.getByRole('form', { name: 'Nouveau client' })
    await u.click(within(f).getByRole('button', { name: 'Choisir dans mes contacts' }))
    expect(within(f).getByLabelText('Nom')).toHaveValue('Moussa Commerçant')
    expect(within(f).getByLabelText('Téléphone')).toHaveValue('+221770001122')
  })

  it('refuse un doublon et propose sa fiche', async () => {
    const { u, enregistrer } = afficher('/clients')
    await u.click(screen.getByRole('button', { name: 'Nouveau client' }))
    const f = screen.getByRole('form', { name: 'Nouveau client' })
    await u.type(within(f).getByLabelText('Nom'), 'dame ')
    expect(within(f).getByRole('link', { name: 'Ouvrir la fiche de Dame' })).toHaveAttribute('href', '/clients/c-dame')
    expect(within(f).getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
    expect(enregistrer).not.toHaveBeenCalled()
  })

  it('bloque un numéro déjà enregistré', async () => {
    const { u } = afficher('/clients')
    await u.click(screen.getByRole('button', { name: 'Nouveau client' }))
    const f = screen.getByRole('form', { name: 'Nouveau client' })
    await u.type(within(f).getByLabelText('Nom'), 'Quelqu’un')
    await u.type(within(f).getByLabelText('Téléphone'), '+221 77 123 45 67')
    expect(f).toHaveTextContent('Ce numéro est déjà celui de Dame')
    expect(within(f).getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it('pour un nom proche, demande de confirmer que c’est une autre personne', async () => {
    const { u, enregistrer } = afficher('/clients')
    await u.click(screen.getByRole('button', { name: 'Nouveau client' }))
    const f = screen.getByRole('form', { name: 'Nouveau client' })
    await u.type(within(f).getByLabelText('Nom'), 'Ababakar')
    expect(within(f).getByRole('alert')).toHaveTextContent('Ressemble à : ABABACAR. Est-ce la même personne ?')
    expect(within(f).getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
    await u.click(within(f).getByRole('checkbox', { name: 'Non, c’est une autre personne' }))
    await u.click(within(f).getByRole('button', { name: 'Enregistrer' }))
    expect(enregistrer).toHaveBeenCalledWith('clients', expect.objectContaining({ nom: 'Ababakar' }))
  })

  it('enregistre le téléphone choisi dans les contacts depuis la fiche', async () => {
    Object.defineProperty(navigator, 'contacts', { configurable: true, value: { select: vi.fn(async () => [{ name: ['X'], tel: ['77 999 88 77'] }]) } })
    const { u, enregistrer } = afficher('/clients/c-aba')
    await u.click(screen.getByRole('button', { name: 'Choisir dans mes contacts' }))
    expect(enregistrer).toHaveBeenCalledWith('clients', expect.objectContaining({ id: 'c-aba', telephone: '779998877' }))
  })
})
