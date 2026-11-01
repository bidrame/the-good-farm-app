import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Bandes } from '../../src/ui/pages/Bandes'
import { BandeFiche } from '../../src/ui/pages/BandeFiche'
import { Reglages } from '../../src/ui/pages/Reglages'
import { DonneesFixes } from '../../src/data/useDonnees'
import { BANDES, ponte } from '../fixtures/bandes'
import type { Bande, Recensement } from '../../src/lib/types'
import type { Donnees } from '../../src/data/useDonnees'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T10:00:00'))
})
afterEach(() => vi.useRealTimers())

function afficher(chemin: string, bandes: Bande[] = BANDES, recensements: Recensement[] = [], extra: Partial<Donnees> = {}) {
  const enregistrer = vi.fn(async (_t: string, l: Record<string, unknown>) => (l.id as string) ?? 'x')
  const pontes = [ponte('b4', '2026-10-30', { oeufs_collectes: 520, mortalite: 3 }), ponte('b4', '2026-10-29', { oeufs_collectes: 500 })]
  render(
    <DonneesFixes donnees={{ bandes, ponte: pontes, recensements, ...extra }} actions={{ enregistrer }}>
      <MemoryRouter initialEntries={[chemin]}>
        <Routes>
          <Route path="/bandes" element={<Bandes />} />
          <Route path="/bandes/:id" element={<BandeFiche />} />
          <Route path="/reglages" element={<Reglages />} />
        </Routes>
      </MemoryRouter>
    </DonneesFixes>,
  )
  return { enregistrer, u: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) }
}

describe('Liste des bandes', () => {
  it('montre âge, phase, effectif et taux moyen des bandes actives', () => {
    afficher('/bandes')
    const ligne = screen.getByRole('link', { name: /BANDE 4/ })
    expect(ligne).toHaveTextContent('box 2')
    expect(ligne).toHaveTextContent('63 sem.')
    expect(ligne).toHaveTextContent('Ponte')
    expect(ligne).toHaveTextContent('510 œufs/jour') // moyenne de 520 et 500 sur 7 jours
    expect(ligne).toHaveTextContent('≈ 647 poules')
    expect(screen.getByRole('link', { name: /BANDE 3/ })).toHaveTextContent('Fin de cycle')
  })
  it('range les bandes réformées à part', () => {
    afficher('/bandes')
    const reformees = screen.getByRole('region', { name: 'Bandes réformées' })
    expect(within(reformees).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringContaining('BANDE 1'), expect.stringContaining('BANDE 2')])
  })
  it('indique qu’aucun box n’est libre', async () => {
    const { u } = afficher('/bandes')
    await u.click(screen.getByRole('button', { name: 'Nouvelle bande' }))
    expect(screen.getByText(/Aucun box libre/)).toBeInTheDocument()
  })
  it('crée une bande dans un box libre', async () => {
    const { u, enregistrer } = afficher('/bandes', BANDES.filter((b) => b.id !== 'b6'))
    await u.click(screen.getByRole('button', { name: 'Nouvelle bande' }))
    const box = screen.getByLabelText('Box') as HTMLSelectElement
    expect([...box.options].map((o) => o.value)).toEqual(['4'])
    await u.type(screen.getByLabelText('Nom'), 'BANDE 7')
    await u.type(screen.getByLabelText('Date de naissance'), '2026-10-01')
    await u.type(screen.getByLabelText('Effectif initial'), '650')
    await u.click(screen.getByRole('button', { name: 'Créer la bande' }))
    expect(enregistrer).toHaveBeenCalledWith('bandes', expect.objectContaining({ nom: 'BANDE 7', box: 4, date_naissance: '2026-10-01', effectif_initial: 650, date_reforme: null }))
  })
})

describe('Fiche bande', () => {
  it('affiche les chiffres clés et réforme la bande', async () => {
    const { u, enregistrer } = afficher('/bandes/b4')
    expect(screen.getByRole('heading', { name: /BANDE 4/ })).toBeInTheDocument()
    expect(screen.getByText('Mortalité cumulée').nextSibling).toHaveTextContent('3')
    expect(screen.getByTestId('courbe')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Réformer' }))
    await u.type(screen.getByLabelText('Date de réforme'), '2026-10-31')
    await u.click(screen.getByRole('button', { name: 'Confirmer la réforme' }))
    expect(enregistrer).toHaveBeenCalledWith('bandes', expect.objectContaining({ id: 'b4', date_reforme: '2026-10-31' }))
  })
})

describe('Modifier une bande', () => {
  it('corrige l’effectif et la date de réforme d’une bande réformée', async () => {
    const { u, enregistrer } = afficher('/bandes/b2')
    await u.click(screen.getByRole('button', { name: 'Modifier' }))
    const f = screen.getByRole('form', { name: 'Modifier la bande' })
    await u.clear(within(f).getByLabelText('Date de réforme'))
    await u.type(within(f).getByLabelText('Date de réforme'), '2026-04-10')
    await u.clear(within(f).getByLabelText('Effectif initial'))
    await u.type(within(f).getByLabelText('Effectif initial'), '655')
    await u.click(within(f).getByRole('button', { name: 'Enregistrer' }))
    expect(enregistrer).toHaveBeenCalledWith('bandes', expect.objectContaining({ id: 'b2', date_reforme: '2026-04-10', effectif_initial: 655 }))
  })
})

describe('Recompter la bande', () => {
  it('enregistre l’effectif compté', async () => {
    const { u, enregistrer } = afficher('/bandes/b4')
    await u.click(screen.getByRole('button', { name: 'Recompter la bande' }))
    const f = screen.getByRole('form', { name: 'Recompter la bande' })
    await u.type(within(f).getByLabelText('Poules comptées'), '630')
    await u.click(within(f).getByRole('button', { name: 'Enregistrer le comptage' }))
    expect(enregistrer).toHaveBeenCalledWith('recensements', expect.objectContaining({ bande_id: 'b4', date: '2026-10-31', effectif: 630 }))
  })
  it('recale l’effectif et montre les poules manquantes constatées', () => {
    afficher('/bandes/b4', BANDES, [{ id: 'r1', bande_id: 'b4', date: '2026-10-20', effectif: 620 }])
    expect(screen.getByText('Effectif actuel').nextSibling).toHaveTextContent('617')
    const zone = screen.getByRole('region', { name: 'Recomptages' })
    expect(zone).toHaveTextContent('20/10/2026')
    expect(zone).toHaveTextContent('620 poules')
    expect(zone).toHaveTextContent('30 manquantes')
  })
})

const OUVRIERS = [{ id: 'o1', nom: 'FALLOU', actif: true }, { id: 'o2', nom: 'DAOUDA', actif: true }]

describe('Boxes et ouvriers', () => {
  it('affecte un ouvrier à un box', async () => {
    const { u, enregistrer } = afficher('/reglages', BANDES, [], { ouvriers: OUVRIERS })
    const zone = screen.getByRole('region', { name: 'Boxes et ouvriers' })
    await u.selectOptions(within(zone).getByLabelText(/Box 2/), 'o2')
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, boxes: [
      { numero: 1, ouvrier_id: null }, { numero: 2, ouvrier_id: 'o2' }, { numero: 3, ouvrier_id: null }, { numero: 4, ouvrier_id: null },
    ] })
  })

  it('marque le calibre d’un box d’un toucher, et l’efface en touchant à nouveau', async () => {
    const boxes = [1, 2, 3, 4].map((numero) => ({ numero, ouvrier_id: null, calibre: numero === 4 ? ('petit' as const) : null }))
    const { u, enregistrer } = afficher('/reglages', BANDES, [], { reglages: [{ id: 1, boxes }] })
    const box1 = screen.getByRole('group', { name: 'Calibre du box 1' })
    await u.click(within(box1).getByRole('button', { name: 'Gros' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, boxes: expect.arrayContaining([{ numero: 1, ouvrier_id: null, calibre: 'gros' }]) })
    const box4 = screen.getByRole('group', { name: 'Calibre du box 4' })
    expect(within(box4).getByRole('button', { name: 'Petit' })).toHaveAttribute('aria-pressed', 'true')
    await u.click(within(box4).getByRole('button', { name: 'Petit' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, boxes: expect.arrayContaining([{ numero: 4, ouvrier_id: null, calibre: null }]) })
  })

  it('ajoute un 5e box, où l’on peut ensuite créer une bande', async () => {
    const { u, enregistrer } = afficher('/bandes', BANDES, [], { ouvriers: OUVRIERS, reglages: [{ id: 1, boxes: [1, 2, 3, 4, 5].map((numero) => ({ numero, ouvrier_id: numero === 5 ? 'o1' : null })) }] })
    await u.click(screen.getByRole('button', { name: 'Nouvelle bande' }))
    expect([...(screen.getByLabelText('Box') as HTMLSelectElement).options].map((o) => o.value)).toEqual(['5'])
    await u.type(screen.getByLabelText('Nom'), 'BANDE 7')
    await u.type(screen.getByLabelText('Date de naissance'), '2026-10-01')
    await u.type(screen.getByLabelText('Effectif initial'), '1000')
    await u.click(screen.getByRole('button', { name: 'Créer la bande' }))
    expect(enregistrer).toHaveBeenCalledWith('bandes', expect.objectContaining({ box: 5, ouvrier_id: 'o1' }))
  })

  it('montre dans les réglages un box sans bande comme libre', () => {
    afficher('/reglages', BANDES, [], { reglages: [{ id: 1, boxes: [1, 2, 3, 4, 5].map((numero) => ({ numero, ouvrier_id: null })) }] })
    expect(within(screen.getByRole('region', { name: 'Boxes et ouvriers' })).getByText(/· libre/)).toBeInTheDocument()
  })

  it('range les boxes dans les réglages : la page Bandes n’y renvoie que par un lien', () => {
    afficher('/bandes')
    expect(screen.queryByRole('region', { name: 'Boxes et ouvriers' })).toBeNull()
    expect(screen.getByRole('link', { name: /Boxes, ouvriers et calibres/ })).toHaveAttribute('href', '/reglages')
  })

  it('le bouton « Nouveau box » enregistre un box de plus', async () => {
    const { u, enregistrer } = afficher('/reglages', BANDES, [], { ouvriers: OUVRIERS })
    await u.click(screen.getByRole('button', { name: 'Nouveau box' }))
    expect(enregistrer).toHaveBeenCalledWith('reglages', { id: 1, boxes: expect.arrayContaining([{ numero: 5, ouvrier_id: null }]) })
  })

  it('montre l’ouvrier du box sur la fiche de la bande', () => {
    afficher('/bandes/b4', BANDES, [], { ouvriers: OUVRIERS, reglages: [{ id: 1, boxes: [{ numero: 2, ouvrier_id: 'o1' }] }] })
    expect(screen.getByText('Ouvrier').nextSibling).toHaveTextContent('FALLOU')
  })
})

describe('Mortalités et effectif à vérifier', () => {
  it('déclare des morts hors saisie de ponte', async () => {
    const { u, enregistrer } = afficher('/bandes/b4')
    await u.click(screen.getByRole('button', { name: 'Déclarer des morts' }))
    const f = screen.getByRole('form', { name: 'Déclarer des morts' })
    await u.type(within(f).getByLabelText('Nombre de morts'), '7')
    await u.click(within(f).getByRole('button', { name: 'Enregistrer les morts' }))
    expect(enregistrer).toHaveBeenCalledWith('mortalites', expect.objectContaining({ bande_id: 'b4', date: '2026-10-31', nombre: 7 }))
  })

  it('compte les morts déclarées dans l’effectif', () => {
    afficher('/bandes/b4', BANDES, [], { mortalites: [{ id: 'm1', bande_id: 'b4', date: '2026-10-25', nombre: 10 }] })
    expect(screen.getByText('Effectif actuel').nextSibling).toHaveTextContent('637') // 650 − 3 (ponte) − 10
  })

  it('signale une bande dont la ponte est impossible pour l’effectif noté', () => {
    const bandes = BANDES.map((b) => (b.id === 'b4' ? { ...b, effectif_initial: 300 } : b))
    afficher('/bandes/b4', bandes)
    const avis = screen.getByRole('status', { name: 'Effectif à vérifier' })
    expect(avis).toHaveTextContent('510 œufs par jour pour 297 poules notées')
    expect(avis).toHaveTextContent(/≈ \d[\d\s]* poules d’après la ponte/)
  })

  it('marque « à vérifier » les bandes non comptées dans la liste', () => {
    const bandes = BANDES.map((b) => (b.id === 'b6' ? { ...b, effectif_verifie: true } : b))
    afficher('/bandes', bandes)
    expect(screen.getByRole('link', { name: /BANDE 4/ })).toHaveTextContent('à vérifier')
    expect(screen.getByRole('link', { name: /BANDE 6/ })).not.toHaveTextContent('à vérifier')
  })

  it('coche « effectif compté » en modifiant la bande', async () => {
    const { u, enregistrer } = afficher('/bandes/b4')
    await u.click(screen.getByRole('button', { name: 'Modifier' }))
    const f = screen.getByRole('form', { name: 'Modifier la bande' })
    await u.click(within(f).getByLabelText(/Effectif compté/))
    await u.click(within(f).getByRole('button', { name: 'Enregistrer' }))
    expect(enregistrer).toHaveBeenCalledWith('bandes', expect.objectContaining({ id: 'b4', effectif_verifie: true }))
  })
})
