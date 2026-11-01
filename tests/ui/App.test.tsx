import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Coquille } from '../../src/App'
import { DonneesFixes } from '../../src/data/useDonnees'

describe('Coquille', () => {
  it('demande la connexion sans session', () => {
    render(<Coquille session={null} />)
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument()
  })
  it('affiche la barre de navigation une fois connecté', () => {
    render(
      <DonneesFixes donnees={{}}>
        <Coquille session={{ user: { id: 'u1' } }} sansDonnees />
      </DonneesFixes>,
    )
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    for (const libelle of ['Accueil', 'Saisir', 'Ponte', 'Livraison', 'Plus']) expect(nav).toHaveTextContent(libelle)
    expect(nav).not.toHaveTextContent('Bandes') // les bandes sont rangées dans « Plus »
    expect(within(nav).getByRole('link', { name: 'Livraison' })).toHaveAttribute('href', '#/livraison')
  })
})

describe('Bandeau d’état', () => {
  it('propose de réessayer quand le serveur ne répond pas', async () => {
    const rafraichir = vi.fn(async () => {})
    render(<DonneesFixes donnees={{}} erreur="Connexion impossible." rafraichir={rafraichir}><Coquille session={{}} sansDonnees /></DonneesFixes>)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(rafraichir).toHaveBeenCalled()
  })

  it('montre les saisies refusées par le serveur et permet de les réessayer ou abandonner', async () => {
    const reessayer = vi.fn(async () => {})
    const abandonner = vi.fn(async () => {})
    const rejetees = [{ op: { id: 'upsert:ponte:p1', table: 'ponte' as const, action: 'upsert' as const, ligne: { id: 'p1' } }, erreur: 'duplicate key value', le: '2026-10-31T10:00:00Z' }]
    render(<DonneesFixes donnees={{}} rejetees={rejetees} actions={{ reessayer, abandonner }}><Coquille session={{}} sansDonnees /></DonneesFixes>)
    const zone = screen.getByRole('region', { name: 'Saisies refusées' })
    expect(zone).toHaveTextContent('Ponte')
    expect(zone).toHaveTextContent('déjà une saisie')
    const u = userEvent.setup()
    await u.click(within(zone).getByRole('button', { name: 'Réessayer' }))
    expect(reessayer).toHaveBeenCalledWith('upsert:ponte:p1')
    await u.click(within(zone).getByRole('button', { name: 'Abandonner' }))
    await u.click(screen.getByRole('button', { name: 'Oui, abandonner' }))
    expect(abandonner).toHaveBeenCalledWith('upsert:ponte:p1')
  })

  it('garde visible, en haut de l’écran, le nombre de saisies qui attendent le réseau', () => {
    render(<DonneesFixes donnees={{}} enAttente={2}><Coquille session={{}} sansDonnees /></DonneesFixes>)
    const bandeau = screen.getByText(/2 saisies gardées sur le téléphone/)
    expect(bandeau.closest('.bandeau-fixe')).not.toBeNull()
  })

  it('dit quelle saisie est refusée, sans message technique, et confirme avant de l’abandonner', async () => {
    const abandonner = vi.fn(async () => {})
    const ligne = { id: 't1', type: 'vente', date: '2026-11-01', montant: 23000 }
    const rejetees = [{ op: { id: 'upsert:transactions:t1', table: 'transactions' as const, action: 'upsert' as const, ligne }, erreur: 'some weird server error', le: '2026-11-01T10:00:00Z' }]
    render(<DonneesFixes donnees={{}} rejetees={rejetees} actions={{ abandonner }}><Coquille session={{}} sansDonnees /></DonneesFixes>)
    const zone = screen.getByRole('region', { name: 'Saisies refusées' })
    expect(zone.textContent?.replace(/\s/g, ' ')).toContain('Vente du 01/11/2026 · 23 000 F')
    expect(zone).not.toHaveTextContent('weird')
    const u = userEvent.setup()
    await u.click(within(zone).getByRole('button', { name: 'Abandonner' }))
    expect(abandonner).not.toHaveBeenCalled()
    await u.click(screen.getByRole('button', { name: 'Oui, abandonner' }))
    expect(abandonner).toHaveBeenCalledWith('upsert:transactions:t1')
  })
})

