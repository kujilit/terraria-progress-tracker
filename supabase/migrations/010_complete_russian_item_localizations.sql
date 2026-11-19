-- Complete item-name localization snapshot from the official Russian Terraria Wiki.
-- The importer refreshes this table on every successful catalog run.

create table if not exists public.tracker_wiki_item_localizations (
  terraria_id integer not null,
  name_en text not null,
  name_ru text not null,
  internal_name text,
  source_page text not null,
  imported_at timestamptz not null default now(),
  primary key (terraria_id, name_en)
);

create index if not exists tracker_wiki_item_localizations_id_idx
  on public.tracker_wiki_item_localizations (terraria_id);

alter table public.tracker_wiki_item_localizations enable row level security;
revoke all privileges on table public.tracker_wiki_item_localizations
  from public, anon, authenticated;
grant all privileges on table public.tracker_wiki_item_localizations
  to service_role;

comment on table public.tracker_wiki_item_localizations is
  'Complete English-to-Russian item-name mapping scraped from the official Russian Terraria Wiki item ID list. Refreshed by scripts/import_terraria_wiki.py.';

update public.tracker_boss_localizations
set source_url = 'https://terraria.wiki.gg/ru/wiki/Боссы';
