-- Répartition du chargement entre les clients (une vente par client).
alter table public.ramassages add column repartition jsonb not null default '[]';
