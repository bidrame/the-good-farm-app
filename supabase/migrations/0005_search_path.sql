-- Recommandation Supabase : chemin de recherche fixe pour les fonctions.
alter function public.f_cle_nom(text) set search_path = '';
alter function public.f_audit() set search_path = '';
