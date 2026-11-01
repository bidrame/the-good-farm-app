-- Produits de dépense comptés comme coûts directs dans la marge brute du mois (accueil).
alter table public.reglages add column couts_directs jsonb;
