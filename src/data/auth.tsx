import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
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

export async function seConnecter(email: string, motDePasse: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
  return error ? 'E-mail ou mot de passe incorrect.' : null
}

export async function seDeconnecter(): Promise<void> {
  await supabase.auth.signOut()
}
