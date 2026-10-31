// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'

const DOSSIER = 'supabase/migrations'
const U1 = '11111111-1111-1111-1111-111111111111'

/** Reproduit ce que Supabase fournit déjà : schéma auth, rôles anon/authenticated. */
const PRELUDE = `
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
`

let db: PGlite

const AUTORISE = 'ferme@example.com'

async function enTantQue(role: 'anon' | 'authenticated', sql: string, email = AUTORISE) {
  await db.exec(`set role ${role}; set request.jwt.claim.sub = '${role === 'authenticated' ? U1 : ''}';
    set request.jwt.claims = '${role === 'authenticated' ? JSON.stringify({ email }) : ''}';`)
  try {
    return await db.query(sql)
  } finally {
    await db.exec('reset role;')
  }
}

const doitEchouer = (sql: string) => expect(db.exec(sql)).rejects.toThrow()

beforeAll(async () => {
  db = new PGlite()
  await db.exec(PRELUDE)
  for (const f of readdirSync(DOSSIER).sort()) await db.exec(readFileSync(`${DOSSIER}/${f}`, 'utf8'))
  await db.exec('grant all on all tables in schema public to anon, authenticated;')
  await db.exec(`insert into public.comptes_autorises (email) values ('${AUTORISE}')`)
  await db.exec(`
    insert into clients (id, nom) values ('00000000-0000-0000-0000-0000000000c1', 'ABABACAR');
    insert into produits (id, nom, type, unite) values ('00000000-0000-0000-0000-0000000000f1', 'Œufs', 'vente', 'plaque');
    insert into bandes (id, nom, box, date_naissance, effectif_initial) values ('00000000-0000-0000-0000-0000000000b6', 'BANDE 6', 4, '2026-05-04', 2600);
  `)
})

afterAll(() => db.close())

describe('contraintes', () => {
  it('refuse un client en double (casse, accents, espaces)', async () => {
    await doitEchouer(`insert into clients (nom) values ('  ababacar ')`)
    await db.exec(`insert into clients (nom) values ('Koné')`)
    await doitEchouer(`insert into clients (nom) values ('KONE')`)
  })
  it('accepte un client au nom proche mais différent', async () => {
    await db.exec(`insert into clients (nom) values ('Babacar'), ('Babacar sicap M')`)
  })
  it('accepte « Autres » à la fois en vente et en dépense', async () => {
    await db.exec(`insert into produits (nom, type, unite) values ('Autres', 'vente', 'forfait'), ('Autres', 'depense', 'forfait')`)
  })
  it('refuse une deuxième bande active dans le même box', async () => {
    await doitEchouer(`insert into bandes (nom, box, date_naissance, effectif_initial) values ('BANDE 7', 4, '2026-10-01', 600)`)
  })
  it('accepte une nouvelle bande dans un box dont la bande est réformée', async () => {
    await db.exec(`
      insert into bandes (nom, box, date_naissance, effectif_initial, date_reforme) values ('BANDE 2', 3, '2024-06-06', 650, '2026-04-14');
      insert into bandes (nom, box, date_naissance, effectif_initial) values ('BANDE 5', 3, '2025-09-09', 620);
    `)
  })
  it('refuse une deuxième ponte pour la même bande et le même jour', async () => {
    await db.exec(`insert into ponte (bande_id, date, oeufs_collectes) values ('00000000-0000-0000-0000-0000000000b6', '2026-10-30', 100)`)
    await doitEchouer(`insert into ponte (bande_id, date, oeufs_collectes) values ('00000000-0000-0000-0000-0000000000b6', '2026-10-30', 200)`)
  })
  it('refuse un montant payé supérieur au montant', async () => {
    await doitEchouer(`
      insert into transactions (date, type, client_id, produit_id, prix_unitaire, quantite, montant, montant_paye)
      values ('2026-10-31', 'vente', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 2600, 20, 52000, 60000)`)
  })
})

describe('sécurité', () => {
  it("ne laisse rien lire ni écrire sans connexion", async () => {
    expect((await enTantQue('anon', 'select * from clients')).rows).toEqual([])
    await expect(enTantQue('anon', `insert into clients (nom) values ('Pirate')`)).rejects.toThrow()
  })
  it('laisse un compte connecté lire et écrire, et note qui a saisi', async () => {
    await enTantQue('authenticated', `insert into clients (id, nom) values ('00000000-0000-0000-0000-0000000000c9', 'Nafi')`)
    const r = await enTantQue('authenticated', `select cree_par from clients where nom = 'Nafi'`)
    expect(r.rows).toEqual([{ cree_par: U1 }])
  })
  it('refuse un compte connecté dont l’e-mail n’est pas autorisé', async () => {
    expect((await enTantQue('authenticated', 'select * from clients', 'inconnu@example.com')).rows).toEqual([])
    await expect(enTantQue('authenticated', `insert into clients (nom) values ('Intrus')`, 'inconnu@example.com')).rejects.toThrow()
  })
  it('accepte l’e-mail autorisé quelle que soit la casse', async () => {
    expect((await enTantQue('authenticated', `select nom from clients where nom = 'Nafi'`, 'Ferme@Example.com')).rows).toHaveLength(1)
  })
  it('ne laisse personne lire la liste des comptes autorisés par l’API', async () => {
    expect((await enTantQue('authenticated', 'select * from comptes_autorises')).rows).toEqual([])
  })
  it('note qui a modifié et quand', async () => {
    await enTantQue('authenticated', `update clients set telephone = '771234567' where nom = 'Nafi'`)
    const r = await db.query<{ modifie_par: string; modifie_le: string | null }>(`select modifie_par, modifie_le from clients where nom = 'Nafi'`)
    expect(r.rows[0].modifie_par).toBe(U1)
    expect(r.rows[0].modifie_le).not.toBeNull()
  })
})

describe('vue des soldes', () => {
  it('calcule le solde des clients à crédit', async () => {
    await db.exec(`
      insert into transactions (date, type, client_id, produit_id, prix_unitaire, quantite, montant, montant_paye)
      values ('2026-10-31', 'vente', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 2600, 20, 52000, 30000);
      insert into paiements (client_id, date, montant, mode) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-31', 10000, 'wave');
    `)
    const r = await db.query(`select solde from v_soldes_clients where client_id = '00000000-0000-0000-0000-0000000000c1'`)
    expect(r.rows).toEqual([{ solde: 12000 }])
  })
})
