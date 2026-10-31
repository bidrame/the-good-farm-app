-- Seuils d'alerte réglables par le propriétaire (baisse de ponte, mortalité, rappel de sauvegarde).
alter table public.reglages add column seuils jsonb;
