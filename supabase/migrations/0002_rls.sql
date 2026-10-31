-- Accès réservé aux comptes connectés (les deux comptes de la ferme ; inscriptions désactivées dans Supabase).
do $$
declare t text;
begin
  foreach t in array array['profils', 'clients', 'produits', 'ouvriers', 'transactions', 'paiements', 'bandes', 'ponte', 'reglages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy connectes on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
