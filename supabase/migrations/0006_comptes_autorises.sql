-- Seuls les e-mails listés ici accèdent aux données, même si un autre compte venait à être créé.
-- La liste elle-même est remplie directement dans la base (jamais dans ce dépôt public).
create table public.comptes_autorises (
  email text primary key check (email = lower(email))
);
-- RLS sans aucune politique : la liste n'est lisible par personne via l'API.
alter table public.comptes_autorises enable row level security;

create or replace function public.est_autorise() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.comptes_autorises where email = lower(auth.jwt() ->> 'email'))
$$;

do $$
declare t text;
begin
  foreach t in array array['profils', 'clients', 'produits', 'ouvriers', 'transactions', 'paiements', 'bandes', 'ponte', 'reglages'] loop
    execute format('drop policy connectes on public.%I', t);
    execute format('create policy connectes on public.%I for all to authenticated using (public.est_autorise()) with check (public.est_autorise())', t);
  end loop;
end $$;
