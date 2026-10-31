// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'

it('distingue les paiements clients et fournisseurs (client par défaut)', async () => {
  const db = new PGlite()
  await db.exec(`create schema auth; create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
    create role anon nologin; create role authenticated nologin;`)
  for (const f of readdirSync('supabase/migrations').sort()) await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'))
  await db.exec(`
    insert into clients (id, nom) values ('00000000-0000-0000-0000-0000000000c1', 'Senelec');
    insert into paiements (client_id, date, montant, mode) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-31', 1000, 'wave');
    insert into paiements (client_id, date, montant, mode, sens) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-31', 2000, 'especes', 'fournisseur');
  `)
  expect((await db.query(`select sens, montant from paiements order by montant`)).rows).toEqual([{ sens: 'client', montant: 1000 }, { sens: 'fournisseur', montant: 2000 }])
  await expect(db.exec(`update paiements set sens = 'autre'`)).rejects.toThrow()
  // La vue des soldes clients ne compte que les paiements clients.
  await db.exec(`insert into produits (id, nom, type) values ('00000000-0000-0000-0000-0000000000f1', 'Œufs', 'vente');
    insert into transactions (date, type, client_id, produit_id, prix_unitaire, quantite, montant, montant_paye)
      values ('2026-10-31', 'vente', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 5000, 1, 5000, 0);`)
  expect((await db.query(`select solde from v_soldes_clients`)).rows).toEqual([{ solde: 4000 }])
  await db.close()
})
