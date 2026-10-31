// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'

it('la table reglages accepte des seuils d’alerte', async () => {
  const db = new PGlite()
  await db.exec(`create schema auth; create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
    create role anon nologin; create role authenticated nologin;`)
  for (const f of readdirSync('supabase/migrations').sort()) await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'))
  await db.exec(`update reglages set seuils = '{"baisse_points": 8}' where id = 1`)
  expect((await db.query(`select seuils from reglages`)).rows).toEqual([{ seuils: { baisse_points: 8 } }])
  await db.close()
})
