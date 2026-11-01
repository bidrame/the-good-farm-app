-- Passage de la voiture : œufs attendus (d'après la ponte) et œufs chargés, box par box.
create table public.ramassages (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  du date not null,
  lignes jsonb not null default '[]',
  observation text,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz,
  modifie_par uuid,
  supprime_le timestamptz,
  check (du <= date)
);
create trigger ramassages_audit before update on public.ramassages for each row execute function public.f_audit();
alter table public.ramassages enable row level security;
create policy connectes on public.ramassages for all to authenticated using (prive.est_autorise()) with check (prive.est_autorise());
