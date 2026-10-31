import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Historique } from '../../src/ui/pages/Historique'
import { Corbeille } from '../../src/ui/pages/Corbeille'
import { Reglages } from '../../src/ui/pages/Reglages'
import { DonneesFixes, type Donnees } from '../../src/data/useDonnees'
import { ferme } from '../fixtures/ferme'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T10:00:00'))
})
afterEach(() => vi.useRealTimers())

function afficher(page: JSX.Element, modif: (d: Partial<Donnees>) => void = () => {}) {
  const d = ferme()
  d.profils = [{ id: 'u-aw', prenom: 'Awa' }]
  d.transactions![0].cree_par = 'u-aw'
  modif(d)
  const actions = { enregistrer: vi.fn(async () => 'x'), supprimer: vi.fn(async () => {}), restaurer: vi.fn(async () => {}) }
  render(<DonneesFixes donnees={d} actions={actions}><MemoryRouter>{page}</MemoryRouter></DonneesFixes>)
  return { ...actions, u: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) }
}

const lignes = () => screen.getAllByRole('article')

describe('Historique', () => {
  it('liste les saisies récentes avec leur auteur', () => {
    afficher(<Historique />)
    expect(lignes()).toHaveLength(7)
    expect(lignes()[0]).toHaveTextContent('Aliment pondeuse')
    expect(lignes().at(-1)).toHaveTextContent('par Awa')
  })
  it('filtre par type et par client', async () => {
    const { u } = afficher(<Historique />)
    await u.selectOptions(screen.getByLabelText('Type'), 'depense')
    expect(lignes()).toHaveLength(1)
    await u.selectOptions(screen.getByLabelText('Type'), 'tout')
    await u.selectOptions(screen.getByLabelText('Client'), 'c-dame')
    expect(lignes()).toHaveLength(2)
  })
  it('filtre par dates', async () => {
    const { u } = afficher(<Historique />)
    await u.type(screen.getByLabelText('Du'), '2026-10-22')
    await u.type(screen.getByLabelText('Au'), '2026-10-22')
    expect(lignes()).toHaveLength(2)
  })
  it('supprime après confirmation', async () => {
    const { u, supprimer } = afficher(<Historique />)
    await u.click(within(lignes()[0]).getByRole('button', { name: 'Supprimer' }))
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    expect(supprimer).toHaveBeenCalledWith('transactions', 't7')
  })
  it('ne propose plus de modifier : on supprime puis on ressaisit', () => {
    afficher(<Historique />)
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
  })
  it('distingue les paiements aux fournisseurs', () => {
    afficher(<Historique />, (d) => { d.paiements = [{ id: 'pf', client_id: 'c-ass', sens: 'fournisseur', date: '2026-10-30', montant: 5000, mode: 'wave' }] })
    expect(screen.getByText('Paiement fournisseur · Ass')).toBeInTheDocument()
  })
  it('masque les lignes supprimées', () => {
    afficher(<Historique />, (d) => { d.transactions![6].supprime_le = '2026-10-30T10:00:00Z' })
    expect(lignes()).toHaveLength(6)
  })
})

describe('Corbeille', () => {
  it('montre les suppressions de moins de 30 jours et les restaure', async () => {
    const { u, restaurer } = afficher(<Corbeille />, (d) => {
      d.transactions![6].supprime_le = '2026-10-30T10:00:00Z'
      d.transactions![5].supprime_le = '2026-09-01T10:00:00Z'
    })
    expect(lignes()).toHaveLength(1)
    await u.click(screen.getByRole('button', { name: 'Restaurer' }))
    expect(restaurer).toHaveBeenCalledWith('transactions', 't7')
  })
})

describe('Réglages', () => {
  it('modifie la courbe de ponte attendue', async () => {
    const { u, enregistrer } = afficher(<Reglages />)
    const champ = screen.getByLabelText('Taux à 30 semaines (%)')
    await u.clear(champ)
    await u.type(champ, '95')
    await u.click(screen.getByRole('button', { name: 'Enregistrer la courbe' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', expect.objectContaining({ id: 1, courbe_attendue: expect.arrayContaining([[30, 0.95]]) }))
  })
  it('ajoute un produit avec son unité', async () => {
    const { u, enregistrer } = afficher(<Reglages />)
    await u.type(screen.getByLabelText('Nouveau produit'), 'Fumier')
    await u.selectOptions(screen.getByLabelText('Type du produit'), 'vente')
    await u.selectOptions(screen.getByLabelText('Unité'), 'kg')
    await u.click(screen.getByRole('button', { name: 'Ajouter le produit' }))
    expect(enregistrer).toHaveBeenCalledWith('produits', { nom: 'Fumier', type: 'vente', unite: 'kg', actif: true })
  })
  it('ajoute et désactive un ouvrier', async () => {
    const { u, enregistrer } = afficher(<Reglages />, (d) => { d.ouvriers = [{ id: 'o1', nom: 'FALLOU', actif: true }] })
    await u.type(screen.getByLabelText('Nouvel ouvrier'), 'DAOUDA')
    await u.click(screen.getByRole('button', { name: 'Ajouter l’ouvrier' }))
    expect(enregistrer).toHaveBeenCalledWith('ouvriers', { nom: 'DAOUDA', actif: true })
    await u.click(screen.getByRole('button', { name: 'Désactiver FALLOU' }))
    expect(enregistrer).toHaveBeenCalledWith('ouvriers', expect.objectContaining({ id: 'o1', actif: false }))
  })
})

describe('Réglages : unités et seuils', () => {
  it('change l’unité d’un produit', async () => {
    const { u, enregistrer } = afficher(<Reglages />)
    await u.selectOptions(screen.getByLabelText('Unité de Poulets frais'), 'kg')
    expect(enregistrer).toHaveBeenCalledWith('produits', expect.objectContaining({ id: 'p-pf', unite: 'kg' }))
  })
  it('règle le seuil d’alerte des dettes fournisseurs', async () => {
    const { u, enregistrer } = afficher(<Reglages />)
    const champ = screen.getByLabelText('Dette fournisseur signalée après (jours)')
    expect(champ).toHaveValue('30')
    await u.clear(champ)
    await u.type(champ, '45')
    await u.click(screen.getByRole('button', { name: 'Enregistrer les seuils' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, seuils: expect.objectContaining({ jours_dette: 45 }) })
  })
  it('modifie les seuils d’alerte', async () => {
    const { u, enregistrer } = afficher(<Reglages />)
    const champ = screen.getByLabelText('Baisse d’œufs signalée (%)')
    expect(champ).toHaveValue('15')
    await u.clear(champ)
    await u.type(champ, '20')
    await u.click(screen.getByRole('button', { name: 'Enregistrer les seuils' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, seuils: { baisse_pct: 20, mortalite_pour_mille: 5, jours_sauvegarde: 7, jours_dette: 30 } })
  })
})

describe('Réglages : conditionnements et inventaire', () => {
  it('ajoute un conditionnement aux conditionnements habituels', async () => {
    const { u, enregistrer } = afficher(<Reglages />)
    const zone = screen.getByRole('region', { name: 'Conditionnements des œufs' })
    expect(zone).toHaveTextContent('Plateau de 30')
    await u.type(within(zone).getByLabelText('Nom'), 'Plateau de 20')
    await u.type(within(zone).getByLabelText('Œufs'), '20')
    await u.click(within(zone).getByRole('button', { name: 'Ajouter' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', expect.objectContaining({
      id: 1, conditionnements: expect.arrayContaining([{ nom: 'Plateau de 30', oeufs: 30 }, { nom: 'Plateau de 20', oeufs: 20 }]),
    }))
  })
  it('enregistre l’inventaire du stock d’œufs du jour', async () => {
    const { u, enregistrer } = afficher(<Reglages />)
    const zone = screen.getByRole('region', { name: 'Inventaire des œufs' })
    await u.type(within(zone).getByLabelText('Plateaux de 30'), '27')
    await u.type(within(zone).getByLabelText('+ œufs'), '10')
    await u.click(within(zone).getByRole('button', { name: 'Enregistrer l’inventaire' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, stock_depart: { date: '2026-10-31', oeufs: 820 } })
  })
})
