import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Historique } from '../../src/ui/pages/Historique'
import { Corbeille } from '../../src/ui/pages/Corbeille'
import { Reglages } from '../../src/ui/pages/Reglages'
import { DonneesFixes, type Donnees } from '../../src/data/useDonnees'
import { ferme } from '../fixtures/ferme'
import { ponte } from '../fixtures/bandes'

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
  it('modifie une vente (quantité, montant payé)', async () => {
    const { u, enregistrer } = afficher(<Historique />)
    const dame = lignes().find((l) => l.textContent?.includes('Œufs · Dame'))!
    await u.click(within(dame).getByRole('button', { name: 'Modifier' }))
    const f = screen.getByRole('form', { name: 'Modifier la saisie' })
    await u.clear(within(f).getByLabelText('Quantité'))
    await u.type(within(f).getByLabelText('Quantité'), '6')
    await u.clear(within(f).getByLabelText('Montant payé'))
    await u.type(within(f).getByLabelText('Montant payé'), '13200')
    await u.click(within(f).getByRole('button', { name: 'Enregistrer' }))
    expect(enregistrer).toHaveBeenCalledWith('transactions', expect.objectContaining({ id: 't3', quantite: 6, montant: 13200, montant_paye: 13200 }))
  })
  it('modifie une dépense payée : elle reste payée en entier', async () => {
    const { u, enregistrer } = afficher(<Historique />, (d) => { d.transactions![6].montant_paye = 60000 })
    await u.click(within(lignes()[0]).getByRole('button', { name: 'Modifier' }))
    const f = screen.getByRole('form', { name: 'Modifier la saisie' })
    await u.clear(within(f).getByLabelText('Quantité'))
    await u.type(within(f).getByLabelText('Quantité'), '5')
    await u.click(within(f).getByRole('button', { name: 'Enregistrer' }))
    expect(enregistrer).toHaveBeenCalledWith('transactions', expect.objectContaining({ id: 't7', type: 'depense', quantite: 5, montant: 75000, montant_paye: 75000 }))
  })
  it('refuse une modification invalide', async () => {
    const { u, enregistrer } = afficher(<Historique />)
    const dame = lignes().find((l) => l.textContent?.includes('Œufs · Dame'))!
    await u.click(within(dame).getByRole('button', { name: 'Modifier' }))
    const f = screen.getByRole('form', { name: 'Modifier la saisie' })
    await u.clear(within(f).getByLabelText('Montant payé'))
    await u.type(within(f).getByLabelText('Montant payé'), '99999')
    await u.click(within(f).getByRole('button', { name: 'Enregistrer' }))
    expect(within(f).getByText(/ne peut pas dépasser/)).toBeInTheDocument()
    expect(enregistrer).not.toHaveBeenCalled()
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

describe('Réglages : coûts directs', () => {
  it('coche d’office l’aliment, pas les salaires, et enregistre la liste quand on coche', async () => {
    const { u, enregistrer } = afficher(<Reglages />)
    const liste = screen.getByRole('region', { name: 'Coûts directs' })
    expect(within(liste).getByRole('checkbox', { name: 'Aliment pondeuse' })).toBeChecked()
    expect(within(liste).getByRole('checkbox', { name: 'Salaires' })).not.toBeChecked()
    await u.click(within(liste).getByRole('checkbox', { name: 'Salaires' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, couts_directs: ['p-alim', 'p-sal'] })
  })
})

describe('Réglages : unités et seuils', () => {
  it('change l’unité d’un produit', async () => {
    const { u, enregistrer } = afficher(<Reglages />)
    await u.selectOptions(screen.getByLabelText('Unité de Poulets frais'), 'kg')
    expect(enregistrer).toHaveBeenCalledWith('produits', expect.objectContaining({ id: 'p-pf', unite: 'kg' }))
  })
  it('règle le seuil d’alerte des dettes fournisseurs avec − et +', async () => {
    const { u, enregistrer } = afficher(<Reglages />)
    const champ = screen.getByLabelText('Dette fournisseur (jours)')
    expect(champ).toHaveValue('30')
    await u.click(screen.getByRole('button', { name: 'Dette fournisseur (jours) : plus' }))
    await u.click(screen.getByRole('button', { name: 'Dette fournisseur (jours) : plus' }))
    expect(champ).toHaveValue('40')
    await u.click(screen.getByRole('button', { name: 'Enregistrer les alertes' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, seuils: expect.objectContaining({ jours_dette: 40 }) })
  })
  it('formule les seuils en phrases, avec un exemple concret', async () => {
    const { u, enregistrer } = afficher(<Reglages />, (d) => {
      d.ponte = Array.from({ length: 7 }, (_, i) => ponte('b6', `2026-10-${24 + i}`, { oeufs_collectes: 2100 }))
    })
    const zone = screen.getByRole('region', { name: 'Mes alertes' })
    expect(zone).toHaveTextContent('Prévenez-moi si les œufs d’une bande baissent de plus de')
    expect(zone).toHaveTextContent('Pour BANDE 6 (≈ 2100 œufs par jour), 15 % ≈ 11 plateaux de moins par jour.')
    const champ = within(zone).getByLabelText('Baisse des œufs (%)')
    await u.clear(champ)
    await u.type(champ, '20')
    await u.click(screen.getByRole('button', { name: 'Enregistrer les alertes' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, seuils: { baisse_pct: 20, alerte_mortalite: false, mortalite_pour_mille: 5, jours_sauvegarde: 7, jours_dette: 30 } })
  })
  it('l’alerte de mortalité est facultative', async () => {
    const { u, enregistrer } = afficher(<Reglages />)
    expect(screen.queryByLabelText('Mortalité (pour mille par jour)')).not.toBeInTheDocument()
    await u.click(screen.getByRole('checkbox', { name: /Me prévenir aussi en cas de morts/ }))
    expect(screen.getByLabelText('Mortalité (pour mille par jour)')).toHaveValue('5')
    await u.click(screen.getByRole('button', { name: 'Enregistrer les alertes' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, seuils: expect.objectContaining({ alerte_mortalite: true }) })
  })
  it('range les réglages en 4 rubriques, la courbe repliée dans « Avancé »', () => {
    afficher(<Reglages />)
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Mes produits et prix', 'Mes boxes et ouvriers', 'Mes alertes', 'Mon compte et sauvegarde'])
    expect(screen.getByText('Avancé : courbe de ponte attendue').closest('details')).not.toHaveAttribute('open')
    expect(screen.getByRole('img', { name: /Courbe de ponte : sommet 93 % à 30 semaines/ })).toBeInTheDocument()
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
  it('enregistre l’inventaire par calibre', async () => {
    const { u, enregistrer } = afficher(<Reglages />)
    const zone = screen.getByRole('region', { name: 'Inventaire des œufs' })
    await u.type(within(zone).getByLabelText(/^Gros/), '40')
    await u.type(within(zone).getByLabelText(/^Petit/), '10')
    await u.type(within(zone).getByLabelText('+ œufs'), '5')
    await u.click(within(zone).getByRole('button', { name: 'Enregistrer l’inventaire' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, stock_depart: { date: '2026-10-31', oeufs: 1505, par_calibre: { gros: 1200, petit: 300 } } })
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
