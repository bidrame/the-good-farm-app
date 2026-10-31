import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Saisir } from '../../src/ui/pages/Saisir'
import { DonneesFixes, type Actions } from '../../src/data/useDonnees'
import { ferme } from '../fixtures/ferme'

const esp = (s: string | null) => (s ?? '').replace(/\s/g, ' ')

function afficher(actions: Partial<Actions> = {}, donnees = ferme()) {
  const enregistrer = vi.fn(async (_t: string, l: Record<string, unknown>) => (l.id as string) ?? 'x')
  render(
    <DonneesFixes donnees={donnees} actions={{ enregistrer, ...actions }}>
      <Saisir />
    </DonneesFixes>,
  )
  return { enregistrer, u: userEvent.setup() }
}

async function choisirClient(u: ReturnType<typeof userEvent.setup>, debut: string, nom: string) {
  await u.type(screen.getByLabelText('Client'), debut)
  await u.click(screen.getByRole('button', { name: nom }))
}

beforeEach(() => sessionStorage.clear())

describe('Saisir une vente', () => {
  it('reprend le dernier prix du client et calcule le montant', async () => {
    const { u } = afficher()
    await choisirClient(u, 'bab', 'Babacar')
    await u.click(screen.getByRole('button', { name: 'Œufs' }))
    expect(screen.getByLabelText(/Prix/)).toHaveValue('2600')
    await u.type(screen.getByLabelText('Quantité'), '20')
    expect(esp(screen.getByTestId('montant').textContent)).toBe('52 000 F')
  })

  it('affiche le reste à payer et refuse un paiement trop grand', async () => {
    const { u, enregistrer } = afficher()
    await choisirClient(u, 'bab', 'Babacar')
    await u.click(screen.getByRole('button', { name: 'Œufs' }))
    await u.type(screen.getByLabelText('Quantité'), '20')
    await u.click(screen.getByRole('button', { name: 'Une partie' }))
    await u.type(screen.getByLabelText('Montant payé'), '30000')
    expect(esp(screen.getByTestId('reste').textContent)).toContain('reste 22 000 F')
    await u.clear(screen.getByLabelText('Montant payé'))
    await u.type(screen.getByLabelText('Montant payé'), '60000')
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(esp(screen.getByText(/ne peut pas dépasser/).textContent)).toBe('Le montant payé ne peut pas dépasser 52 000 F')
    expect(enregistrer).not.toHaveBeenCalled()
  })

  it('enregistre une vente à crédit', async () => {
    const { u, enregistrer } = afficher()
    await choisirClient(u, 'bab', 'Babacar')
    await u.click(screen.getByRole('button', { name: 'Œufs' }))
    await u.type(screen.getByLabelText('Quantité'), '20')
    await u.click(screen.getByRole('button', { name: 'Rien (crédit)' }))
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(enregistrer).toHaveBeenCalledWith('transactions', expect.objectContaining({
      type: 'vente', client_id: 'c-bab', produit_id: 'p-oeufs', prix_unitaire: 2600, quantite: 20, montant: 52000, montant_paye: 0,
    }))
    expect(screen.getByText(/Enregistré/)).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Nouvelle saisie' }))
    expect(screen.getByLabelText('Client')).toHaveValue('')
  })

  it('propose le client existant au lieu d’un doublon', async () => {
    const { u } = afficher()
    await u.type(screen.getByLabelText('Client'), 'abab')
    expect(screen.getByRole('button', { name: 'ABABACAR' })).toBeInTheDocument()
    await u.type(screen.getByLabelText('Client'), 'acar')
    expect(screen.queryByRole('button', { name: /Ajouter/ })).not.toBeInTheDocument()
  })

  it('ajoute un nouveau client', async () => {
    const { u, enregistrer } = afficher()
    await u.type(screen.getByLabelText('Client'), 'Maguette')
    await u.click(screen.getByRole('button', { name: 'Ajouter « Maguette »' }))
    expect(enregistrer).toHaveBeenCalledWith('clients', expect.objectContaining({ nom: 'Maguette' }))
  })

  it('demande confirmation pour une vente déjà saisie', async () => {
    const d = ferme()
    d.transactions!.push({ ...d.transactions![1], id: 'jour', date: new Date().toLocaleDateString('sv-SE'), quantite: 20, montant: 52000 })
    const { u, enregistrer } = afficher({}, d)
    await choisirClient(u, 'bab', 'Babacar')
    await u.click(screen.getByRole('button', { name: 'Œufs' }))
    await u.type(screen.getByLabelText('Quantité'), '20')
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }))
    const dialogue = screen.getByRole('dialog')
    expect(dialogue).toHaveTextContent('Déjà saisi ?')
    await u.click(within(dialogue).getByRole('button', { name: 'Annuler' }))
    expect(enregistrer).not.toHaveBeenCalled()
  })

  it('montre les 4 produits les plus vendus et « Autre… »', () => {
    afficher()
    const zone = screen.getByRole('group', { name: 'Produit' })
    const noms = within(zone).getAllByRole('button').map((b) => b.textContent)
    expect(noms).toEqual(['Œufs', 'Poulets congelés', 'Poulets frais', 'Poulets sur pieds', 'Autre…']) // égalité : ordre alphabétique
  })

  it('garde la saisie en cours si l’écran est rechargé', async () => {
    const { u } = afficher()
    await u.type(screen.getByLabelText('Quantité'), '7')
    cleanup()
    afficher()
    expect(screen.getByLabelText('Quantité')).toHaveValue('7')
  })
})

describe('Saisir une dépense', () => {
  it('n’exige pas de client et montre les produits de dépense', async () => {
    const { u, enregistrer } = afficher()
    await u.click(screen.getByRole('button', { name: 'Dépense' }))
    await u.click(screen.getByRole('button', { name: 'Aliment pondeuse' }))
    expect(screen.getByLabelText(/Prix/)).toHaveValue('15000')
    await u.type(screen.getByLabelText('Quantité'), '4')
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(enregistrer).toHaveBeenCalledWith('transactions', expect.objectContaining({ type: 'depense', client_id: null, montant: 60000, montant_paye: 0 }))
  })
})

describe('Saisir : robustesse', () => {
  it('n’enregistre qu’une fois en cas de double appui', async () => {
    const enregistrer = vi.fn(() => new Promise<string>(() => {}))
    render(<DonneesFixes donnees={ferme()} actions={{ enregistrer }}><Saisir /></DonneesFixes>)
    const u = userEvent.setup()
    await u.click(screen.getByRole('button', { name: 'Dépense' }))
    await u.click(screen.getByRole('button', { name: 'Aliment pondeuse' }))
    await u.type(screen.getByLabelText('Quantité'), '4')
    await u.click(screen.getByRole('button', { name: /Enregistrer|Enregistrement/ }))
    await u.click(screen.getByRole('button', { name: /Enregistrer|Enregistrement/ }))
    expect(enregistrer).toHaveBeenCalledTimes(1)
  })

  it('remet la date du jour si le brouillon resté ouvert est vide', () => {
    sessionStorage.setItem('brouillon-saisie', JSON.stringify({ type: 'vente', date: '2020-01-01', client_id: null, produit_id: null, quantite: null, prix_unitaire: null }))
    afficher()
    expect(screen.getByLabelText('Date')).not.toHaveValue('2020-01-01')
  })

  it('garde la date d’un brouillon commencé', () => {
    sessionStorage.setItem('brouillon-saisie', JSON.stringify({ type: 'vente', date: '2026-10-30', client_id: 'c-bab', produit_id: null, quantite: 5, prix_unitaire: null }))
    afficher()
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-30')
  })

  it('signale un nombre décimal au lieu de l’arrondir', async () => {
    const { u } = afficher()
    await u.type(screen.getByLabelText('Quantité'), '2,5')
    expect(screen.getByText('Nombre entier attendu')).toBeInTheDocument()
  })
})
