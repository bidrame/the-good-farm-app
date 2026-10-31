-- Ventes d'œufs par conditionnement (plateau de 30, carton de 360, boîtes…) et stock d'œufs.
alter table public.transactions add column oeufs_par_unite integer check (oeufs_par_unite > 0);
alter table public.reglages add column conditionnements jsonb;
alter table public.reglages add column stock_depart jsonb;
