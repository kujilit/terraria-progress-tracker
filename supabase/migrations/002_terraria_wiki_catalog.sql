-- Terraria Progress Tracker: official Wiki catalog snapshot
-- Apply after 001_initial_schema.sql. The importer writes a new batch and only
-- publishes it after every item, recipe and ingredient row has been uploaded.

create table if not exists public.tracker_catalog_imports (
  batch_id uuid primary key,
  source text not null default 'terraria.wiki.gg',
  source_revision text,
  status text not null default 'loading'
    check (status in ('loading', 'published', 'failed')),
  items_count integer not null default 0 check (items_count >= 0),
  recipes_count integer not null default 0 check (recipes_count >= 0),
  ingredients_count integer not null default 0 check (ingredients_count >= 0),
  started_at timestamptz not null default now(),
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists tracker_catalog_imports_published_idx
  on public.tracker_catalog_imports (published_at desc)
  where status = 'published';

create table if not exists public.tracker_catalog_items (
  batch_id uuid not null references public.tracker_catalog_imports(batch_id) on delete cascade,
  item_key text not null,
  terraria_id integer,
  internal_name text,
  name text not null,
  name_ru text,
  page_title text,
  wiki_url text,
  primary_category text not null
    check (primary_category in ('weapon', 'armor', 'accessory', 'ammo', 'material')),
  categories text[] not null default '{}'::text[],
  classes text[] not null default '{}'::text[],
  class_assignment text not null default 'wiki-fields',
  stage text,
  icon text not null default '◆',
  description text not null default '',
  source_note text,
  damage numeric,
  damage_type text,
  defense integer,
  ammo_type integer,
  max_stack integer,
  rarity integer,
  hardmode boolean,
  is_shared boolean not null default false,
  slot_metadata jsonb not null default '{}'::jsonb,
  raw_cargo jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  primary key (batch_id, item_key)
);

create index if not exists tracker_catalog_items_classes_gin_idx
  on public.tracker_catalog_items using gin (classes);
create index if not exists tracker_catalog_items_categories_gin_idx
  on public.tracker_catalog_items using gin (categories);
create index if not exists tracker_catalog_items_name_idx
  on public.tracker_catalog_items (lower(name));

create table if not exists public.tracker_catalog_recipes (
  batch_id uuid not null,
  recipe_key text not null,
  result_item_key text not null,
  result_terraria_id integer,
  result_name text not null,
  result_quantity integer not null default 1 check (result_quantity > 0),
  crafting_station text,
  version text,
  note text,
  source_page text,
  source_url text,
  raw_args text,
  raw_cargo jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  primary key (batch_id, recipe_key),
  constraint tracker_catalog_recipes_item_fk
    foreign key (batch_id, result_item_key)
    references public.tracker_catalog_items (batch_id, item_key)
    on delete cascade
);

create index if not exists tracker_catalog_recipes_result_idx
  on public.tracker_catalog_recipes (batch_id, result_item_key);

create table if not exists public.tracker_catalog_recipe_ingredients (
  batch_id uuid not null,
  recipe_key text not null,
  ingredient_order integer not null check (ingredient_order > 0),
  ingredient_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  linked_item_key text,
  alternative_names jsonb not null default '[]'::jsonb,
  primary key (batch_id, recipe_key, ingredient_order),
  constraint tracker_catalog_ingredients_recipe_fk
    foreign key (batch_id, recipe_key)
    references public.tracker_catalog_recipes (batch_id, recipe_key)
    on delete cascade,
  constraint tracker_catalog_ingredients_item_fk
    foreign key (batch_id, linked_item_key)
    references public.tracker_catalog_items (batch_id, item_key)
    on delete cascade
);

create index if not exists tracker_catalog_recipe_ingredients_item_idx
  on public.tracker_catalog_recipe_ingredients (batch_id, linked_item_key);

alter table public.tracker_catalog_imports enable row level security;
alter table public.tracker_catalog_items enable row level security;
alter table public.tracker_catalog_recipes enable row level security;
alter table public.tracker_catalog_recipe_ingredients enable row level security;

revoke all privileges on table
  public.tracker_catalog_imports,
  public.tracker_catalog_items,
  public.tracker_catalog_recipes,
  public.tracker_catalog_recipe_ingredients
from public, anon, authenticated;

grant usage on schema public to service_role;
grant all privileges on table
  public.tracker_catalog_imports,
  public.tracker_catalog_items,
  public.tracker_catalog_recipes,
  public.tracker_catalog_recipe_ingredients
to service_role;

create or replace function public.tracker_catalog_list(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_batch_id uuid;
  v_result jsonb;
begin
  select * into v_ctx
  from private.tracker_session_context(p_token);

  if not found then
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select i.batch_id into v_batch_id
  from public.tracker_catalog_imports i
  where i.status = 'published'
  order by i.published_at desc
  limit 1;

  if v_batch_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.item_key,
        'name', item.name,
        'ru', coalesce(nullif(item.name_ru, ''), item.name),
        'gameClass', to_jsonb(item.classes),
        'category', item.primary_category,
        'stage', coalesce(item.stage, 'Not specified'),
        'icon', item.icon,
        'description', item.description,
        'source', coalesce(item.source_note, item.page_title, 'Terraria Wiki'),
        'station', (
          select r.crafting_station
          from public.tracker_catalog_recipes r
          where r.batch_id = v_batch_id and r.result_item_key = item.item_key
          order by r.version nulls first, r.recipe_key
          limit 1
        ),
        'verified', true,
        'recipe', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'itemId', coalesce(ing.linked_item_key, 'name_' || lower(regexp_replace(ing.ingredient_name, '[^a-zA-Z0-9]+', '-', 'g'))),
              'qty', ing.quantity
            ) order by ing.ingredient_order
          )
          from (
            select preferred.recipe_key
            from public.tracker_catalog_recipes preferred
            where preferred.batch_id = v_batch_id
              and preferred.result_item_key = item.item_key
            order by preferred.version nulls first, preferred.recipe_key
            limit 1
          ) preferred
          join public.tracker_catalog_recipe_ingredients ing
            on ing.batch_id = v_batch_id
           and ing.recipe_key = preferred.recipe_key
        ), '[]'::jsonb),
        'recipes', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', r.recipe_key,
              'station', r.crafting_station,
              'amount', r.result_quantity,
              'version', r.version,
              'ingredients', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'itemId', coalesce(ri.linked_item_key, 'name_' || lower(regexp_replace(ri.ingredient_name, '[^a-zA-Z0-9]+', '-', 'g'))),
                    'name', ri.ingredient_name,
                    'qty', ri.quantity,
                    'alternatives', ri.alternative_names
                  ) order by ri.ingredient_order
                )
                from public.tracker_catalog_recipe_ingredients ri
                where ri.batch_id = r.batch_id and ri.recipe_key = r.recipe_key
              ), '[]'::jsonb)
            ) order by r.version nulls first, r.recipe_key
          )
          from public.tracker_catalog_recipes r
          where r.batch_id = v_batch_id and r.result_item_key = item.item_key
        ), '[]'::jsonb)
      )
      order by item.name
    ), '[]'::jsonb
  )
  into v_result
  from public.tracker_catalog_items item
  where item.batch_id = v_batch_id
    and cardinality(item.classes) > 0;

  return v_result;
end;
$$;

revoke all on function public.tracker_catalog_list(text) from public;
grant execute on function public.tracker_catalog_list(text) to anon, authenticated;

comment on table public.tracker_catalog_imports is
  'Published Cargo snapshot batches. Import runs become visible only after status changes to published.';
comment on table public.tracker_catalog_items is
  'Equipment and crafting ingredients imported from Terraria Wiki Cargo Items.';
comment on table public.tracker_catalog_recipes is
  'Recipes from Terraria Wiki Cargo Recipes that are required by the imported equipment dependency graph.';
comment on table public.tracker_catalog_recipe_ingredients is
  'Normalized recipe ingredients; alternatives are retained rather than collapsed.';
