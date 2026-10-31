// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'

it('accepte un 5e box, l’effectif vérifié et les mortalités, réservées aux comptes autorisés', async () => {
  const db = new PGlite()
  await db.exec(`create schema auth; create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create role anon nologin; create role authenticated nologin; grant usage on schema public, auth to anon, authenticated;`)
  for (const f of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'))
  await db.exec(`grant all on all tables in schema public to anon, authenticated;
    insert into bandes (id, nom, box, date_naissance, effectif_initial, effectif_verifie) values ('00000000-0000-0000-0000-0000000000b7', 'BANDE 7', 5, '2026-10-01', 1000, true);
    insert into mortalites (bande_id, date, nombre) values ('00000000-0000-0000-0000-0000000000b7', '2026-10-31', 4);
    insert into reglages (id, boxes) values (1, '[{"numero": 5, "ouvrier_id": null}]') on conflict (id) do update set boxes = excluded.boxes;`)
  await expect(db.exec(`insert into mortalites (bande_id, date, nombre) values ('00000000-0000-0000-0000-0000000000b7', '2026-10-31', 0)`)).rejects.toThrow()
  await expect(db.exec(`insert into bandes (nom, box, date_naissance, effectif_initial) values ('X', 0, '2026-10-01', 10)`)).rejects.toThrow()
  expect((await db.query(`select effectif_verifie from bandes`)).rows).toEqual([{ effectif_verifie: true }])
  await db.exec(`set role authenticated; set request.jwt.claims = '{"email":"intrus@example.com"}';`)
  expect((await db.query(`select * from mortalites`)).rows).toEqual([])
  await db.exec('reset role')
  await db.close()
})
