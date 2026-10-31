-- Recomptages des bandes : l'effectif repart du nombre compté (la mortalité est souvent mal notée).
create table public.recensements (
  id uuid primary key default gen_random_uuid(),
  bande_id uuid not null references public.bandes (id),
  date date not null,
  effectif integer not null check (effectif >= 0),
  observation text,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz,
  modifie_par uuid,
  supprime_le timestamptz
);
create unique index recensements_bande_jour on public.recensements (bande_id, date) where supprime_le is null;
create trigger recensements_audit before update on public.recensements for each row execute function public.f_audit();
alter table public.recensements enable row level security;
create policy connectes on public.recensements for all to authenticated using (prive.est_autorise()) with check (prive.est_autorise());
