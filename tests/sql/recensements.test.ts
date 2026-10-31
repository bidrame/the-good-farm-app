// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'

it('enregistre un recomptage par bande et par jour, réservé aux comptes autorisés', async () => {
  const db = new PGlite()
  await db.exec(`create schema auth; create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create role anon nologin; create role authenticated nologin; grant usage on schema public, auth to anon, authenticated;`)
  for (const f of readdirSync('supabase/migrations').sort()) await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'))
  await db.exec(`grant all on all tables in schema public to anon, authenticated;
    insert into bandes (id, nom, box, date_naissance, effectif_initial) values ('00000000-0000-0000-0000-0000000000b6', 'BANDE 6', 4, '2026-05-04', 2600);
    insert into recensements (bande_id, date, effectif) values ('00000000-0000-0000-0000-0000000000b6', '2026-10-31', 2400);`)
  await expect(db.exec(`insert into recensements (bande_id, date, effectif) values ('00000000-0000-0000-0000-0000000000b6', '2026-10-31', 2300)`)).rejects.toThrow()
  await db.exec(`set role authenticated; set request.jwt.claims = '{"email":"intrus@example.com"}';`)
  expect((await db.query(`select * from recensements`)).rows).toEqual([])
  await db.exec('reset role')
  await db.close()
})
