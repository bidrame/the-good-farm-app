import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Saisir } from '../../src/ui/pages/Saisir'
import { DonneesFixes, type Actions } from '../../src/data/useDonnees'
import { ferme } from '../fixtures/ferme'
import { tx } from '../fixtures/tx'

const esp = (s: string | null) => (s ?? '').replace(/\s/g, ' ')

function afficher(actions: Partial<Actions> = {}, donnees = ferme(), chemin = '/saisir') {
  const enregistrer = vi.fn(async (_t: string, l: Record<string, unknown>) => (l.id as string) ?? 'x')
  render(
    <DonneesFixes donnees={donnees} actions={{ enregistrer, ...actions }}>
      <MemoryRouter initialEntries={[chemin]}><Saisir /></MemoryRouter>
    </DonneesFixes>,
  )
  return { enregistrer, u: userEvent.setup() }
}

type U = ReturnType<typeof userEvent.setup>

async function choisirClient(u: U, debut: string, nom: string) {
  await u.type(screen.getByLabelText('Client'), debut)
  await u.click(screen.getByRole('button', { name: nom }))
}

async function venteOeufs(u: U, quantite = '20') {
  await choisirClient(u, 'bab', 'Babacar')
  await u.click(screen.getByRole('button', { name: 'Œufs' }))
  await u.type(screen.getByLabelText('Quantité'), quantite)
}

const continuer = (u: U) => u.click(screen.getByRole('button', { name: 'Continuer' }))
const valider = (u: U) => u.click(within(screen.getByRole('region', { name: 'Récapitulatif' })).getByRole('button', { name: 'Valider' }))

beforeEach(() => sessionStorage.clear())

describe('Saisir une vente', () => {
  it('reprend le dernier prix du client et calcule le montant', async () => {
    const { u } = afficher()
    await venteOeufs(u)
    expect(screen.getByLabelText(/Prix/)).toHaveValue('2600')
    expect(esp(screen.getByTestId('montant').textContent)).toBe('52 000 F')
    expect(screen.getByText('= 600 œufs')).toBeInTheDocument()
  })

  it('montre un récapitulatif avant d’enregistrer, puis enregistre', async () => {
    const { u, enregistrer } = afficher()
    await venteOeufs(u)
    await u.click(screen.getByRole('button', { name: 'Rien (crédit)' }))
    await continuer(u)
    const recap = screen.getByRole('region', { name: 'Récapitulatif' })
    expect(esp(recap.textContent)).toContain('Babacar')
    expect(esp(recap.textContent)).toContain('20 × Plateau de 30')
    expect(esp(recap.textContent)).toContain('52 000 F')
    expect(esp(recap.textContent)).toContain('À crédit')
    expect(enregistrer).not.toHaveBeenCalled()
    await valider(u)
    expect(enregistrer).toHaveBeenCalledWith('transactions', expect.objectContaining({
      type: 'vente', client_id: 'c-bab', produit_id: 'p-oeufs', prix_unitaire: 2600, quantite: 20, montant: 52000, montant_paye: 0, oeufs_par_unite: 30,
    }))
    expect(screen.getByText('Vente enregistrée')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Nouvelle saisie' }))
    expect(screen.getByLabelText('Client')).toHaveValue('')
  })

  it('revient au formulaire sans rien perdre avec « Modifier »', async () => {
    const { u, enregistrer } = afficher()
    await venteOeufs(u)
    await continuer(u)
    await u.click(screen.getByRole('button', { name: 'Modifier' }))
    expect(screen.getByLabelText('Quantité')).toHaveValue('20')
    await u.clear(screen.getByLabelText('Quantité'))
    await u.type(screen.getByLabelText('Quantité'), '25')
    await continuer(u)
    await valider(u)
    expect(enregistrer).toHaveBeenCalledWith('transactions', expect.objectContaining({ quantite: 25, montant: 65000 }))
  })

  it('vend en boîtes de 12 avec le prix de la boîte', async () => {
    const d = ferme()
    d.transactions!.push(tx({ id: 'boite', date: '2026-10-28', client_id: 'c-bab', produit_id: 'p-oeufs', prix_unitaire: 1100, quantite: 3, oeufs_par_unite: 12 }))
    const { u, enregistrer } = afficher({}, d)
    await choisirClient(u, 'bab', 'Babacar')
    await u.click(screen.getByRole('button', { name: 'Œufs' }))
    await u.click(screen.getByRole('button', { name: 'Boîte de 12' }))
    expect(screen.getByLabelText(/Prix/)).toHaveValue('1100')
    await u.type(screen.getByLabelText('Quantité'), '5')
    expect(screen.getByText('= 60 œufs')).toBeInTheDocument()
    await continuer(u)
    await valider(u)
    expect(enregistrer).toHaveBeenCalledWith('transactions', expect.objectContaining({ quantite: 5, montant: 5500, oeufs_par_unite: 12 }))
  })

  it('affiche le reste à payer et refuse un paiement trop grand', async () => {
    const { u, enregistrer } = afficher()
    await venteOeufs(u)
    await u.click(screen.getByRole('button', { name: 'Une partie' }))
    await u.type(screen.getByLabelText('Montant payé'), '30000')
    expect(esp(screen.getByTestId('reste').textContent)).toContain('reste 22 000 F')
    await u.clear(screen.getByLabelText('Montant payé'))
    await u.type(screen.getByLabelText('Montant payé'), '60000')
    await continuer(u)
    expect(esp(screen.getByText(/ne peut pas dépasser/).textContent)).toBe('Le montant payé ne peut pas dépasser 52 000 F')
    expect(screen.queryByRole('region', { name: 'Récapitulatif' })).not.toBeInTheDocument()
    expect(enregistrer).not.toHaveBeenCalled()
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
    await venteOeufs(u)
    await continuer(u)
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
  it('s’ouvre directement en dépense depuis le raccourci de l’accueil', () => {
    afficher({}, ferme(), '/saisir?type=depense')
    expect(screen.getByRole('button', { name: 'Dépense' })).toHaveClass('choisi')
    expect(screen.getByRole('button', { name: 'Aliment pondeuse' })).toBeInTheDocument()
  })

  it('n’exige pas de client et montre les produits de dépense', async () => {
    const { u, enregistrer } = afficher()
    await u.click(screen.getByRole('button', { name: 'Dépense' }))
    await u.click(screen.getByRole('button', { name: 'Aliment pondeuse' }))
    expect(screen.getByLabelText(/Prix/)).toHaveValue('15000')
    await u.type(screen.getByLabelText('Quantité'), '4')
    await continuer(u)
    await valider(u)
    expect(enregistrer).toHaveBeenCalledWith('transactions', expect.objectContaining({ type: 'depense', client_id: null, montant: 60000, montant_paye: 60000, oeufs_par_unite: null }))
    expect(screen.getByText('Dépense enregistrée')).toBeInTheDocument()
  })

  it('exige le fournisseur pour une dépense à payer plus tard', async () => {
    const { u, enregistrer } = afficher()
    await u.click(screen.getByRole('button', { name: 'Dépense' }))
    await u.click(screen.getByRole('button', { name: 'Aliment pondeuse' }))
    await u.type(screen.getByLabelText('Quantité'), '4')
    await u.click(screen.getByRole('button', { name: 'Rien (à payer)' }))
    await continuer(u)
    expect(screen.getByText('Fournisseur obligatoire si tout n’est pas payé')).toBeInTheDocument()
    await u.type(screen.getByLabelText('Fournisseur'), 'dam')
    await u.click(screen.getByRole('button', { name: 'Dame' }))
    await continuer(u)
    expect(esp(screen.getByRole('region', { name: 'Récapitulatif' }).textContent)).toContain('Reste à payer60 000 F')
    await valider(u)
    expect(enregistrer).toHaveBeenCalledWith('transactions', expect.objectContaining({ type: 'depense', client_id: 'c-dame', montant_paye: 0 }))
    expect(screen.getByText(/reste 60 000 F à payer/)).toBeInTheDocument()
  })
})

describe('Saisir : robustesse', () => {
  it('n’enregistre qu’une fois en cas de double appui', async () => {
    const enregistrer = vi.fn(() => new Promise<string>(() => {}))
    const { u } = afficher({ enregistrer })
    await u.click(screen.getByRole('button', { name: 'Dépense' }))
    await u.click(screen.getByRole('button', { name: 'Aliment pondeuse' }))
    await u.type(screen.getByLabelText('Quantité'), '4')
    await continuer(u)
    const recap = screen.getByRole('region', { name: 'Récapitulatif' })
    await u.click(within(recap).getByRole('button', { name: /Valider|Enregistrement/ }))
    await u.click(within(recap).getByRole('button', { name: /Valider|Enregistrement/ }))
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
