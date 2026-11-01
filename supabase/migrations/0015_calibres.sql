-- Calibre des œufs vendus (petit, moyen, gros) ; le calibre des box est rangé dans reglages.boxes.
alter table public.transactions add column calibre text check (calibre in ('petit', 'moyen', 'gros'));
