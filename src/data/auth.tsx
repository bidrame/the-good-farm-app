import { useEffect, useState } from 'react'
import { AuthRetryableFetchError, isAuthRetryableFetchError, type AuthError, type Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export function useSession(): { session: Session | null; pret: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [pret, setPret] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setPret(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return { session, pret }
}

/** Message à montrer : avec un réseau faible, il ne faut pas faire croire que le mot de passe est faux. */
export function messageConnexion(error: AuthError | null, enLigne: boolean): string | null {
  if (!error) return null
  if (error.status === 400 || error.code === 'invalid_credentials') return 'E-mail ou mot de passe incorrect.'
  if (!enLigne || isAuthRetryableFetchError(error)) return 'Pas de connexion internet. Vérifiez le réseau, puis réessayez.'
  return 'Connexion impossible pour le moment. Réessayez dans un instant.'
}

export async function seConnecter(email: string, motDePasse: string): Promise<string | null> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
    return messageConnexion(error, navigator.onLine)
  } catch {
    return messageConnexion(new AuthRetryableFetchError('fetch', 0), navigator.onLine)
  }
}

export async function seDeconnecter(): Promise<void> {
  await supabase.auth.signOut()
}
