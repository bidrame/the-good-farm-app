-- The Good Farm : schéma de base.
-- Montants en FCFA entiers ; dates métier en type date ; suppression douce via supprime_le.

-- Clé de comparaison des noms (même règle que cleNom côté appli) : sans accents, minuscules, espaces réduits.
create or replace function public.f_cle_nom(t text) returns text
language sql immutable as $$
  select btrim(regexp_replace(lower(translate(t,
    'ÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝàâäáãåçéèêëíìîïñóòôöõúùûüýÿ',
    'AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyy')), '\s+', ' ', 'g'))
$$;

create or replace function public.f_audit() returns trigger
language plpgsql as $$
begin
  new.modifie_le := now();
  new.modifie_par := auth.uid();
  return new;
end $$;

create table public.profils (
  id uuid primary key,
  prenom text not null
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (btrim(nom) <> ''),
  telephone text,
  notes text,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz,
  modifie_par uuid,
  supprime_le timestamptz
);
create unique index clients_nom_unique on public.clients (public.f_cle_nom(nom)) where supprime_le is null;

create table public.produits (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (btrim(nom) <> ''),
  type text not null check (type in ('vente', 'depense')),
  unite text not null default 'unite' check (unite in ('plaque', 'unite', 'kg', 'forfait', 'autre')),
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz,
  modifie_par uuid,
  supprime_le timestamptz
);
create unique index produits_nom_unique on public.produits (public.f_cle_nom(nom), type) where supprime_le is null;

create table public.ouvriers (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (btrim(nom) <> ''),
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz,
  modifie_par uuid,
  supprime_le timestamptz
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null check (type in ('vente', 'depense')),
  client_id uuid references public.clients (id),
  produit_id uuid not null references public.produits (id),
  prix_unitaire bigint not null check (prix_unitaire >= 0),
  quantite numeric(12, 3) not null check (quantite > 0),
  montant bigint not null check (montant >= 0),
  montant_paye bigint not null default 0 check (montant_paye >= 0 and montant_paye <= montant),
  observation text,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz,
  modifie_par uuid,
  supprime_le timestamptz
);
create index transactions_date on public.transactions (date);
create index transactions_client on public.transactions (client_id);

create table public.paiements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  date date not null,
  montant bigint not null check (montant > 0),
  mode text not null check (mode in ('especes', 'wave', 'orange_money', 'virement', 'autre')),
  observation text,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz,
  modifie_par uuid,
  supprime_le timestamptz
);

create table public.bandes (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (btrim(nom) <> ''),
  box smallint not null check (box between 1 and 4),
  ouvrier_id uuid references public.ouvriers (id),
  date_naissance date not null,
  effectif_initial integer not null check (effectif_initial > 0),
  date_reforme date check (date_reforme is null or date_reforme >= date_naissance),
  observations text,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz,
  modifie_par uuid,
  supprime_le timestamptz
);
-- Une seule bande active par box.
create unique index bandes_box_active on public.bandes (box) where date_reforme is null and supprime_le is null;

create table public.ponte (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  bande_id uuid not null references public.bandes (id),
  oeufs_collectes integer not null default 0 check (oeufs_collectes >= 0),
  oeufs_perdus integer not null default 0 check (oeufs_perdus >= 0),
  mortalite integer not null default 0 check (mortalite >= 0),
  aliment_kg numeric(10, 2) check (aliment_kg >= 0),
  observation text,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz,
  modifie_par uuid,
  supprime_le timestamptz
);
-- Une seule saisie par bande et par jour.
create unique index ponte_bande_jour on public.ponte (bande_id, date) where supprime_le is null;

-- Réglages partagés : une seule ligne (id = 1).
create table public.reglages (
  id smallint primary key default 1 check (id = 1),
  courbe_attendue jsonb,
  derniere_sauvegarde date,
  modifie_le timestamptz,
  modifie_par uuid
);
insert into public.reglages (id) values (1);

do $$
declare t text;
begin
  foreach t in array array['clients', 'produits', 'ouvriers', 'transactions', 'paiements', 'bandes', 'ponte', 'reglages'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.f_audit()', t || '_audit', t);
  end loop;
end $$;
