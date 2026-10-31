-- La vérification des comptes autorisés passe dans un schéma non exposé par l'API (pas d'appel /rpc possible).
create schema if not exists prive;
grant usage on schema prive to authenticated;

create or replace function prive.est_autorise() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.comptes_autorises where email = lower(auth.jwt() ->> 'email'))
$$;
revoke all on function prive.est_autorise() from public, anon;
grant execute on function prive.est_autorise() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['profils', 'clients', 'produits', 'ouvriers', 'transactions', 'paiements', 'bandes', 'ponte', 'reglages'] loop
    execute format('drop policy connectes on public.%I', t);
    execute format('create policy connectes on public.%I for all to authenticated using (prive.est_autorise()) with check (prive.est_autorise())', t);
  end loop;
end $$;

drop function public.est_autorise();
