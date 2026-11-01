import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Ramassage } from '../../src/ui/pages/Ramassage'
import { DonneesFixes, type Donnees } from '../../src/data/useDonnees'
import { BANDES, ponte } from '../fixtures/bandes'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T10:00:00'))
})
afterEach(() => vi.useRealTimers())

// BANDE 3 (box 1, Fallou) : 300 œufs/jour ; BANDE 4 (box 2) : 600 œufs/jour dont 30 cassés. Le 31 n'est pas encore saisi.
const jours = ['25', '26', '27', '28', '29', '30']
const pontes = [
  ...jours.map((j) => ponte('b3', `2026-10-${j}`, { oeufs_collectes: 300 })),
  ...jours.filter((j) => j !== '28').map((j) => ponte('b4', `2026-10-${j}`, { oeufs_collectes: 600, oeufs_perdus: 30 })),
]

const clients = [{ id: 'c-m', nom: 'Moussa' }, { id: 'c-i', nom: 'Ibou' }]
const produits = [{ id: 'p-oeufs', nom: 'Œufs', type: 'vente' as const, unite: 'plaque' as const, actif: true }]
const venteMoussa = { id: 'v0', date: '2026-10-20', type: 'vente' as const, client_id: 'c-m', produit_id: 'p-oeufs', quantite: 10, prix_unitaire: 2100, montant: 21000, montant_paye: 0, oeufs_par_unite: 30 }

function afficher(extra: Partial<Donnees> = {}) {
  const enregistrer = vi.fn(async (_t: string, l: Record<string, unknown>) => (l.id as string) ?? 'x')
  render(
    <DonneesFixes donnees={{ bandes: BANDES, ponte: pontes, clients, produits, transactions: [venteMoussa], ramassages: [passageDu30], ouvriers: [{ id: 'fallou', nom: 'FALLOU', actif: true }], reglages: [{ id: 1, boxes: [1, 2, 3, 4].map((numero) => ({ numero, ouvrier_id: numero === 1 ? 'fallou' : null })) }], ...extra }} actions={{ enregistrer }}>
      <MemoryRouter><Ramassage /></MemoryRouter>
    </DonneesFixes>,
  )
  return { enregistrer, u: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) }
}

// Passage quotidien : la voiture est passée le 30, elle repasse le 31 pour la ponte du 30.
const passageDu30 = { id: 'r30', date: '2026-10-30', du: '2026-10-29', lignes: [], repartition: [] }
const charge400 = { id: 'r1', date: '2026-10-31', du: '2026-10-30', lignes: [{ numero: 0, theorique: 12000, charge: 12000, matin: 0 }], repartition: [] }

describe('Ramassage', () => {
  it('par défaut, emporte la ponte d’hier : le même chiffre que l’accueil', () => {
    afficher()
    expect(screen.getByRole('region', { name: 'Total à livrer' })).toHaveTextContent('29 plateaux')
    expect(screen.getByRole('region', { name: 'Total à livrer' })).toHaveTextContent('ramassage du 30/10/2026')
    expect(screen.getByRole('region', { name: 'Total à livrer' })).not.toHaveTextContent('prévus')
    expect(screen.getByRole('article', { name: 'Box 1' })).toHaveTextContent('Box 1 · FALLOU')
    expect(screen.getByRole('article', { name: 'Box 1' })).toHaveTextContent('300 œufs')
  })

  it('sur plusieurs jours, additionne la ponte et signale les jours non saisis', () => {
    afficher()
    fireEvent.change(screen.getByLabelText('Ramassage depuis le'), { target: { value: '2026-10-25' } })
    expect(screen.getByRole('article', { name: 'Box 1' })).toHaveTextContent('1800 œufs')
    expect(screen.getByRole('article', { name: 'Box 2' })).toHaveTextContent('Ponte non saisie : 28/10/2026 — non comptée')
  })

  it('charge au magasin en un seul chiffre, prérempli avec le prévu, et montre l’écart', async () => {
    const { u, enregistrer } = afficher()
    fireEvent.change(screen.getByLabelText('Jour de la livraison'), { target: { value: '2026-10-31' } })
    await u.click(screen.getByRole('button', { name: 'Charger et répartir entre les clients' }))
    const f = screen.getByRole('form', { name: 'Plateaux chargés' })
    const champ = within(f).getByLabelText(/^Plateaux ramassés jusqu’à hier soir/)
    expect(champ).toHaveValue('29')
    expect(f).toHaveTextContent('conforme')
    await u.clear(champ)
    await u.type(champ, '26')
    expect(f).toHaveTextContent('3 plateaux de moins que prévu')
    await u.click(within(f).getByRole('button', { name: 'Continuer vers la répartition' }))
    expect(enregistrer).toHaveBeenCalledWith('ramassages', expect.objectContaining({
      date: '2026-10-31', du: '2026-10-30', repartition: [], lignes: [{ numero: 0, calibre: null, theorique: 870, charge: 780, matin: 0 }],
    }))
  })

  it('ajoute la collecte du matin au chargement', async () => {
    const { u, enregistrer } = afficher()
    fireEvent.change(screen.getByLabelText('Jour de la livraison'), { target: { value: '2026-10-31' } })
    await u.click(screen.getByRole('button', { name: 'Charger et répartir entre les clients' }))
    const f = screen.getByRole('form', { name: 'Plateaux chargés' })
    expect(within(f).queryByRole('group', { name: 'Ramassés ce matin' })).toBeNull()
    await u.click(within(f).getByRole('checkbox', { name: 'Le bus part après le ramassage du matin' }))
    const matin = within(f).getByRole('group', { name: 'Ramassés ce matin' })
    await u.type(within(matin).getByLabelText(/^Box 1 · Non classé/), '12')
    expect(f).toHaveTextContent('Total chargé41 plateaux')
    await u.click(within(f).getByRole('button', { name: 'Continuer vers la répartition' }))
    expect(enregistrer).toHaveBeenCalledWith('ramassages', expect.objectContaining({ lignes: [{ numero: 0, calibre: null, theorique: 870, charge: 1230, matin: 360 }] }))
  })

  it('au passage suivant, retire ce qui a été emporté le matin', () => {
    // La voiture est passée le 30 au matin et a pris 5 plateaux ; ponte du 30 saisie le soir : 29 plateaux.
    afficher({ ramassages: [{ id: 'r0', date: '2026-10-30', du: '2026-10-29', lignes: [{ numero: 0, theorique: 0, charge: 150, matin: 150 }] }] })
    const total = screen.getByRole('region', { name: 'Total à livrer' })
    expect(total).toHaveTextContent('24 plateaux')
    expect(total).toHaveTextContent('ramassage 29 plateaux − 5 plateaux déjà partis le matin du 30/10/2026')
  })

  it('pour un passage à venir, estime les jours restants sans proposer le chargement', () => {
    afficher()
    fireEvent.change(screen.getByLabelText('Jour de la livraison'), { target: { value: '2026-11-02' } })
    expect(screen.getByRole('article', { name: 'Box 1' })).toHaveTextContent('dont ≈ 600 prévus') // 31/10 et 01/11
    expect(screen.queryByRole('button', { name: 'Charger et répartir entre les clients' })).not.toBeInTheDocument()
  })

  it('ne préremplit pas le jour de la livraison : il faut le choisir avant de charger', () => {
    afficher()
    expect(screen.getByLabelText('Jour de la livraison')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Charger et répartir entre les clients' })).toBeDisabled()
    expect(screen.getByText('Choisissez d’abord le jour de la livraison.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Jour de la livraison'), { target: { value: '2026-10-31' } })
    expect(screen.getByRole('button', { name: 'Charger et répartir entre les clients' })).toBeEnabled()
  })

  it('choisit aujourd’hui ou demain en un toucher', async () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Demain' }))
    expect(screen.getByLabelText('Jour de la livraison')).toHaveValue('2026-11-01')
    fireEvent.click(screen.getByRole('button', { name: 'Aujourd’hui' }))
    expect(screen.getByLabelText('Jour de la livraison')).toHaveValue('2026-10-31')
    expect(screen.getByRole('button', { name: 'Aujourd’hui' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Charger et répartir entre les clients' })).toBeEnabled()
  })

  it('met « Charger le bus » avant le détail des box', () => {
    afficher()
    const charger = screen.getByRole('region', { name: 'Charger et répartir' })
    const box1 = screen.getByRole('article', { name: 'Box 1' })
    expect(charger.compareDocumentPosition(box1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('ignore une date effacée au lieu de planter', () => {
    afficher()
    fireEvent.change(screen.getByLabelText('Jour de la livraison'), { target: { value: '' } })
    expect(screen.getByRole('region', { name: 'Total à livrer' })).toHaveTextContent('29 plateaux')
  })

  it('sans aucun passage enregistré, reprend toute la ponte encore au magasin', () => {
    afficher({ ramassages: [] })
    expect(screen.getByLabelText('Ramassage depuis le')).toHaveValue('2026-10-25')
  })

  it('repart du jour du dernier passage', () => {
    afficher({ ramassages: [{ id: 'r0', date: '2026-10-28', du: '2026-10-27', lignes: [] }] })
    expect(screen.getByLabelText('Ramassage depuis le')).toHaveValue('2026-10-28')
  })
})

describe('Répartition entre les clients', () => {
  it('chaque quantité fait baisser le reste, puis une vente est créée par client', async () => {
    const { u, enregistrer } = afficher({ ramassages: [charge400] })
    await u.click(screen.getByRole('button', { name: 'Répartir entre les clients' }))
    const f = screen.getByRole('form', { name: 'Répartition entre les clients' })
    const reste = () => within(f).getByRole('status', { name: 'Reste à répartir' })
    expect(reste()).toHaveTextContent('400 plateaux')

    await u.type(within(f).getByLabelText('Client 1'), 'Mous')
    await u.click(within(f).getByRole('button', { name: 'Moussa' }))
    expect(within(f).getAllByLabelText('Prix du plateau')[0]).toHaveValue('2100') // son dernier prix
    await u.type(within(f).getAllByLabelText('Plateaux')[0], '100')
    expect(reste()).toHaveTextContent('300 plateaux')
    await u.click(within(within(f).getByRole('group', { name: 'Calibre client 1' })).getByRole('button', { name: 'Gros' }))

    await u.click(within(f).getByRole('button', { name: 'Ajouter un client' }))
    await u.type(within(f).getByLabelText('Client 2'), 'Ibou')
    await u.click(within(f).getByRole('button', { name: 'Ibou' }))
    await u.type(within(f).getAllByLabelText('Plateaux')[1], '50')
    await u.type(within(f).getAllByLabelText('Prix du plateau')[1], '2000')
    expect(reste()).toHaveTextContent('250 plateaux')
    expect(f).toHaveTextContent('300 plateaux − 50 = 250 plateaux')
    await u.click(within(within(f).getByRole('group', { name: 'Paiement client 2' })).getByRole('button', { name: 'Payé' }))

    // Le calibre est obligatoire : le client 2 n'en a pas encore.
    await u.click(within(f).getByRole('button', { name: 'Enregistrer les ventes' }))
    expect(within(f).getByText('Choisissez le calibre vendu à chaque client.')).toBeInTheDocument()
    expect(enregistrer).not.toHaveBeenCalledWith('transactions', expect.anything())
    await u.click(within(within(f).getByRole('group', { name: 'Calibre client 2' })).getByRole('button', { name: 'Petit' }))
    expect(reste()).toHaveTextContent('250 plateaux') // non trié : un seul reste pour tous les calibres

    await u.click(within(f).getByRole('button', { name: 'Enregistrer les ventes' }))
    expect(enregistrer).toHaveBeenCalledWith('transactions', expect.objectContaining({
      date: '2026-10-31', type: 'vente', client_id: 'c-m', produit_id: 'p-oeufs', quantite: 100, prix_unitaire: 2100, montant: 210000, montant_paye: 0, oeufs_par_unite: 30, calibre: 'gros',
    }))
    expect(enregistrer).toHaveBeenCalledWith('transactions', expect.objectContaining({ client_id: 'c-i', quantite: 50, montant: 100000, montant_paye: 100000, calibre: 'petit' }))
    expect(enregistrer).toHaveBeenCalledWith('ramassages', expect.objectContaining({
      id: 'r1', repartition: [expect.objectContaining({ client_id: 'c-m', plateaux: 100 }), expect.objectContaining({ client_id: 'c-i', plateaux: 50 })],
    }))
  })

  it('empêche de répartir plus que le chargement', async () => {
    const { u } = afficher({ ramassages: [charge400] })
    await u.click(screen.getByRole('button', { name: 'Répartir entre les clients' }))
    const f = screen.getByRole('form', { name: 'Répartition entre les clients' })
    await u.type(within(f).getAllByLabelText('Plateaux')[0], '450')
    expect(within(f).getByRole('status', { name: 'Reste à répartir' })).toHaveTextContent('Trop réparti50 plateaux')
    expect(within(f).getByRole('button', { name: 'Enregistrer les ventes' })).toBeDisabled()
  })

  it('un chargement non trié : tous les calibres se vendent sur le même reste', () => {
    afficher({ ramassages: [{ ...charge400, repartition: [{ client_id: 'c-m', calibre: 'gros', plateaux: 100, prix: 2100, transaction_id: 't1' }] }] })
    expect(screen.getByRole('region', { name: 'Livraisons précédentes' })).toHaveTextContent('Reste à répartir : 300 plateaux')
  })

  it('montre qui a été livré et ce qu’il reste à répartir', () => {
    afficher({ ramassages: [{ ...charge400, repartition: [{ client_id: 'c-m', plateaux: 100, prix: 2100, transaction_id: 't1' }] }] })
    const precedents = screen.getByRole('region', { name: 'Livraisons précédentes' })
    expect(precedents).toHaveTextContent('Livré : Moussa 100')
    expect(precedents).toHaveTextContent('Reste à répartir : 300 plateaux')
  })
})

describe('Calibres', () => {
  // Box 1 (BANDE 3, 300 œufs = 10 plateaux) en gros ; box 2 (BANDE 4, 570 œufs = 19 plateaux) en petit.
  const reglages = [{ id: 1, boxes: [1, 2, 3, 4].map((numero) => ({ numero, ouvrier_id: null, calibre: numero === 1 ? ('gros' as const) : numero === 2 ? ('petit' as const) : null })) }]

  it('le matin peut apporter un calibre absent du magasin : il a sa propre ligne', async () => {
    const boxes2 = [1, 2, 3, 4].map((numero) => ({ numero, ouvrier_id: null, calibre: numero === 1 ? ('gros' as const) : numero === 3 ? ('moyen' as const) : null }))
    const { u, enregistrer } = afficher({ reglages: [{ id: 1, boxes: boxes2, stock_depart: { date: '2026-10-30', oeufs: 3000, par_calibre: { gros: 3000 } } }], ramassages: [], transactions: [] })
    fireEvent.change(screen.getByLabelText('Jour de la livraison'), { target: { value: '2026-10-31' } })
    await u.click(screen.getByRole('button', { name: 'Charger et répartir entre les clients' }))
    const f = screen.getByRole('form', { name: 'Plateaux chargés' })
    await u.click(within(f).getByRole('checkbox', { name: 'Le bus part après le ramassage du matin' }))
    await u.type(within(within(f).getByRole('group', { name: 'Ramassés ce matin' })).getByLabelText(/^Box 3 · Moyen/), '8')
    expect(f).toHaveTextContent('Total chargé108 plateaux')
    await u.click(within(f).getByRole('button', { name: 'Continuer vers la répartition' }))
    expect(enregistrer).toHaveBeenCalledWith('ramassages', expect.objectContaining({ lignes: [
      { numero: 0, calibre: 'gros', theorique: 3000, charge: 3000, matin: 0 },
      { numero: 0, calibre: 'moyen', theorique: 0, charge: 240, matin: 240 },
    ] }))
  })

  it('trie le total à ramasser selon le calibre des box', () => {
    afficher({ reglages })
    expect(screen.getByRole('region', { name: 'Total à livrer' })).toHaveTextContent('Gros 10Petit 19')
  })

  it('charge par calibre, avec la collecte du matin répartie comme la ponte', async () => {
    const { u, enregistrer } = afficher({ reglages })
    fireEvent.change(screen.getByLabelText('Jour de la livraison'), { target: { value: '2026-10-31' } })
    await u.click(screen.getByRole('button', { name: 'Charger et répartir entre les clients' }))
    const f = screen.getByRole('form', { name: 'Plateaux chargés' })
    expect(within(f).getByLabelText(/^Gros/)).toHaveValue('10')
    expect(within(f).getByLabelText(/^Petit/)).toHaveValue('19')
    await u.click(within(f).getByRole('checkbox', { name: 'Le bus part après le ramassage du matin' }))
    const matin = within(f).getByRole('group', { name: 'Ramassés ce matin' })
    await u.type(within(matin).getByLabelText(/^Box 1 · Gros/), '10')
    await u.type(within(matin).getByLabelText(/^Box 2 · Petit/), '19')
    expect(matin).toHaveTextContent('Total du matin : Gros 10Petit 19')
    await u.click(within(f).getByRole('button', { name: 'Continuer vers la répartition' }))
    expect(enregistrer).toHaveBeenCalledWith('ramassages', expect.objectContaining({ lignes: [
      { numero: 0, calibre: 'gros', theorique: 300, charge: (10 + 10) * 30, matin: 300 },
      { numero: 0, calibre: 'petit', theorique: 570, charge: (19 + 19) * 30, matin: 570 },
    ] }))
  })

  it('répartit chaque calibre avec son propre reste et enregistre le calibre de la vente', async () => {
    const charge = { id: 'r1', date: '2026-10-31', du: '2026-10-30', repartition: [], lignes: [
      { numero: 0, calibre: 'gros' as const, theorique: 3000, charge: 3000, matin: 0 },
      { numero: 0, calibre: 'petit' as const, theorique: 1500, charge: 1500, matin: 0 },
    ] }
    const { u, enregistrer } = afficher({ ramassages: [charge], reglages })
    await u.click(screen.getByRole('button', { name: 'Répartir entre les clients' }))
    const f = screen.getByRole('form', { name: 'Répartition entre les clients' })
    expect(within(f).getByLabelText('Reste Gros')).toHaveTextContent('Gros 100')
    expect(within(f).getByLabelText('Reste Petit')).toHaveTextContent('Petit 50')
    await u.type(within(f).getByLabelText('Client 1'), 'Mous')
    await u.click(within(f).getByRole('button', { name: 'Moussa' }))
    await u.type(within(f).getAllByLabelText('Plateaux')[0], '60')
    expect(within(f).getByLabelText('Reste Gros')).toHaveTextContent('Gros 40')
    await u.click(within(f).getByRole('button', { name: 'Ajouter un client' }))
    expect(within(within(f).getByRole('group', { name: 'Calibre client 2' })).getByRole('button', { name: 'Gros' })).toHaveAttribute('aria-pressed', 'true')
    await u.click(within(within(f).getByRole('group', { name: 'Calibre client 2' })).getByRole('button', { name: 'Petit' }))
    await u.type(within(f).getByLabelText('Client 2'), 'Ibou')
    await u.click(within(f).getByRole('button', { name: 'Ibou' }))
    await u.type(within(f).getAllByLabelText('Plateaux')[1], '70')
    expect(within(f).getByLabelText('Reste Petit')).toHaveTextContent('Petit -20')
    expect(within(f).getByRole('button', { name: 'Enregistrer les ventes' })).toBeDisabled()
    await u.clear(within(f).getAllByLabelText('Plateaux')[1])
    await u.type(within(f).getAllByLabelText('Plateaux')[1], '50')
    await u.type(within(f).getAllByLabelText('Prix du plateau')[1], '1800')
    await u.click(within(f).getByRole('button', { name: 'Enregistrer les ventes' }))
    expect(enregistrer).toHaveBeenCalledWith('transactions', expect.objectContaining({ client_id: 'c-m', calibre: 'gros', quantite: 60 }))
    expect(enregistrer).toHaveBeenCalledWith('transactions', expect.objectContaining({ client_id: 'c-i', calibre: 'petit', quantite: 50, prix_unitaire: 1800 }))
  })
})

describe('Livraison depuis le stock du magasin', () => {
  // Inventaire du 30 au soir : 100 plateaux gros. Le 31 (aujourd'hui), box 1 en gros a ramassé 300 œufs = 10 plateaux.
  const boxes = [1, 2, 3, 4].map((numero) => ({ numero, ouvrier_id: null, calibre: numero === 1 ? ('gros' as const) : numero === 2 ? ('petit' as const) : null }))
  const reglages = [{ id: 1, boxes, stock_depart: { date: '2026-10-30', oeufs: 3000, par_calibre: { gros: 3000 } } }]
  const aujourdhuiSaisi = [...pontes, ponte('b3', '2026-10-31', { oeufs_collectes: 300 })]

  it('propose tout le stock, ramassage du jour compris', () => {
    afficher({ reglages, ponte: aujourdhuiSaisi, ramassages: [], transactions: [] })
    const total = screen.getByRole('region', { name: 'Total à livrer' })
    expect(total).toHaveTextContent('Le bus peut emporter110 plateaux')
    expect(total).toHaveTextContent('Gros 110')
    expect(screen.queryByLabelText('Ramassage depuis le')).toBeNull()
  })

  it('met à part les plateaux chargés mais pas encore répartis', () => {
    const enCours = { id: 'r1', date: '2026-10-31', du: '2026-10-31', repartition: [], lignes: [{ numero: 0, calibre: 'gros' as const, theorique: 0, charge: 1200, matin: 0 }] }
    afficher({ reglages, ponte: aujourdhuiSaisi, ramassages: [enCours], transactions: [] })
    const total = screen.getByRole('region', { name: 'Total à livrer' })
    expect(total).toHaveTextContent('70 plateaux')
    expect(total).toHaveTextContent('au magasin 110 plateaux − 40 plateaux encore dans le bus')
  })

  it('préremplit le chargement avec le stock par calibre', async () => {
    const { u, enregistrer } = afficher({ reglages, ponte: aujourdhuiSaisi, ramassages: [], transactions: [] })
    fireEvent.change(screen.getByLabelText('Jour de la livraison'), { target: { value: '2026-10-31' } })
    await u.click(screen.getByRole('button', { name: 'Charger et répartir entre les clients' }))
    const f = screen.getByRole('form', { name: 'Plateaux chargés' })
    expect(within(f).getByLabelText(/^Gros/)).toHaveValue('110')
    await u.click(within(f).getByRole('button', { name: 'Continuer vers la répartition' }))
    expect(enregistrer).toHaveBeenCalledWith('ramassages', expect.objectContaining({
      date: '2026-10-31', du: '2026-10-31', lignes: [{ numero: 0, calibre: 'gros', theorique: 3300, charge: 3300, matin: 0 }],
    }))
  })
})
