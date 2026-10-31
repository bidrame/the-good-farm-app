import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

/** Client Supabase avec la clé service_role, lue dans .env.local (jamais commité). */
export function clientAdmin() {
  if (existsSync('.env.local'))
    for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  const url = process.env.VITE_SUPABASE_URL
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !cle) throw new Error('VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être dans .env.local')
  return createClient(url, cle, { auth: { persistSession: false } })
}
