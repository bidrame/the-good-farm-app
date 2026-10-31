import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Rapports } from '../../src/ui/pages/Rapports'
import { DonneesFixes } from '../../src/data/useDonnees'
import { ferme } from '../fixtures/ferme'
import { tx } from '../fixtures/tx'

const esp = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T10:00:00'))
})
afterEach(() => vi.useRealTimers())

function afficher() {
  const d = ferme()
  d.transactions!.push(tx({ id: 'ancien', date: '2025-03-10', client_id: 'c-ass', prix_unitaire: 900000 }))
  render(<DonneesFixes donnees={d}><Rapports /></DonneesFixes>)
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

const lignes = (nom: string) => within(screen.getByRole('region', { name: nom })).getAllByRole('row').slice(1).map((r) => esp(r.textContent))

describe('Rapports', () => {
  it('montre les œufs dans les ventes par produit', () => {
    afficher()
    expect(lignes('Ventes par produit')[0]).toMatch(/^Œufs.*60 000 F/)
  })
  it('classe vraiment les clients par chiffre d’affaires', () => {
    afficher()
    expect(lignes('Classement des clients').map((l) => l.split(/\d/)[0])).toEqual(['Babacar', 'Dame', 'Ass'])
  })
  it('filtre la période', async () => {
    const u = afficher()
    expect(lignes('Classement des clients')).toHaveLength(3)
    await u.selectOptions(screen.getByLabelText('Période'), 'tout')
    expect(lignes('Classement des clients')[0]).toMatch(/^Ass/)
    expect(lignes('Bilan par année').map((l) => l.slice(0, 4))).toEqual(['2025', '2026'])
  })
  it('résume les œufs vendus en plateaux et prix moyen du plateau', () => {
    afficher()
    const zone = screen.getByRole('region', { name: 'Œufs vendus' })
    expect(esp(zone.textContent)).toContain('750 œufs')
    expect(esp(zone.textContent)).toContain('25 plateaux')
    expect(esp(zone.textContent)).toContain('2 400 F')
  })
  it('détaille les dépenses par poste', () => {
    afficher()
    expect(lignes('Dépenses par poste')[0]).toMatch(/^Aliment pondeuse.*60 000 F/)
  })
})
