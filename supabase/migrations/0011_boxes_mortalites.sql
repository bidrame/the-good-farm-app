-- La ferme peut ajouter des boxes ; chaque box a son ouvrier (dans reglages.boxes).
alter table public.bandes drop constraint if exists bandes_box_check;
alter table public.bandes add constraint bandes_box_check check (box between 1 and 99);
alter table public.reglages add column boxes jsonb;

-- Effectif initial compté pour de bon ; sinon l'appli l'estime d'après la ponte.
alter table public.bandes add column effectif_verifie boolean not null default false;

-- Morts constatées en dehors de la saisie de ponte.
create table public.mortalites (
  id uuid primary key default gen_random_uuid(),
  bande_id uuid not null references public.bandes (id),
  date date not null,
  nombre integer not null check (nombre > 0),
  observation text,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz,
  modifie_par uuid,
  supprime_le timestamptz
);
create trigger mortalites_audit before update on public.mortalites for each row execute function public.f_audit();
alter table public.mortalites enable row level security;
create policy connectes on public.mortalites for all to authenticated using (prive.est_autorise()) with check (prive.est_autorise());
