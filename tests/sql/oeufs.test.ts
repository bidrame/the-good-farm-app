// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'

it('enregistre le conditionnement des ventes d’œufs, les conditionnements et le stock de départ', async () => {
  const db = new PGlite()
  await db.exec(`create schema auth; create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
    create role anon nologin; create role authenticated nologin;`)
  for (const f of readdirSync('supabase/migrations').sort()) await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'))
  await db.exec(`
    insert into produits (id, nom, type, unite) values ('00000000-0000-0000-0000-0000000000f1', 'Œufs', 'vente', 'plaque');
    insert into transactions (date, type, produit_id, prix_unitaire, quantite, montant, oeufs_par_unite)
      values ('2026-10-31', 'vente', '00000000-0000-0000-0000-0000000000f1', 1000, 5, 5000, 12);
    update reglages set conditionnements = '[{"nom":"Plateau de 20","oeufs":20}]', stock_depart = '{"date":"2026-10-31","oeufs":300}';
  `)
  expect((await db.query(`select oeufs_par_unite from transactions`)).rows).toEqual([{ oeufs_par_unite: 12 }])
  await expect(db.exec(`update transactions set oeufs_par_unite = 0`)).rejects.toThrow()
  expect((await db.query(`select stock_depart->>'oeufs' as o from reglages`)).rows).toEqual([{ o: '300' }])
  await db.close()
})
