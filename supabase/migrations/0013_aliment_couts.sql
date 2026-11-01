-- Stock d'aliment (inventaire, sacs, alerte) et dépenses exclues du prix de revient des œufs.
alter table public.reglages add column aliment jsonb;
alter table public.reglages add column couts_exclus jsonb;
