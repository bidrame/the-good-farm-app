import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { messageConnexion } from '../../src/data/auth'

describe('Message de connexion', () => {
  it('dit que l’e-mail ou le mot de passe est faux seulement quand c’est le cas', () => {
    expect(messageConnexion(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'), true)).toBe('E-mail ou mot de passe incorrect.')
  })

  it('parle du réseau quand le téléphone n’a pas de connexion', () => {
    expect(messageConnexion(new AuthRetryableFetchError('Failed to fetch', 0), false)).toMatch(/Pas de connexion internet/)
    expect(messageConnexion(new AuthRetryableFetchError('Failed to fetch', 0), true)).toMatch(/Pas de connexion internet/)
  })

  it('reste général pour une autre panne du serveur', () => {
    expect(messageConnexion(new AuthApiError('Service unavailable', 503, undefined), true)).toMatch(/Connexion impossible pour le moment/)
  })

  it('ne renvoie rien sans erreur', () => {
    expect(messageConnexion(null, true)).toBeNull()
  })
})
