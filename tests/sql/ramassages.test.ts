// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'

it('enregistre un ramassage par box, réservé aux comptes autorisés', async () => {
  const db = new PGlite()
  await db.exec(`create schema auth; create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create role anon nologin; create role authenticated nologin; grant usage on schema public, auth to anon, authenticated;`)
  for (const f of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'))
  await db.exec(`grant all on all tables in schema public to anon, authenticated;
    insert into ramassages (date, du, lignes) values ('2026-10-31', '2026-10-28', '[{"numero": 1, "theorique": 3000, "charge": 2970}]');`)
  await expect(db.exec(`insert into ramassages (date, du) values ('2026-10-27', '2026-10-28')`)).rejects.toThrow()
  expect((await db.query(`select lignes from ramassages`)).rows).toEqual([{ lignes: [{ numero: 1, theorique: 3000, charge: 2970 }] }])
  await db.exec(`set role authenticated; set request.jwt.claims = '{"email":"intrus@example.com"}';`)
  expect((await db.query(`select * from ramassages`)).rows).toEqual([])
  await db.exec('reset role')
  await db.close()
})
