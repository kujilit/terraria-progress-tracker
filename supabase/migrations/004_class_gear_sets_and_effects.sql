-- Add class-aware gear effects, explicit armor-set grouping, and buff metadata.
-- Apply after 003_catalog_item_images.sql, then run the catalog importer once.

alter table public.tracker_catalog_items
  add column if not exists equipment_effect text,
  add column if not exists armor_set_id text,
  add column if not exists armor_set_name text,
  add column if not exists armor_set_bonus text,
  add column if not exists buff_name text,
  add column if not exists buff_duration text;

create index if not exists tracker_catalog_items_armor_set_idx
  on public.tracker_catalog_items (batch_id, armor_set_id)
  where armor_set_id is not null;

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
        'classAssignment', item.class_assignment,
        'damage', item.damage,
        'damageType', item.damage_type,
        'defense', item.defense,
        'equipmentEffect', item.equipment_effect,
        'armorSetId', item.armor_set_id,
        'armorSetName', item.armor_set_name,
        'armorSetBonus', item.armor_set_bonus,
        'buffName', item.buff_name,
        'buffDuration', item.buff_duration,
        'source', coalesce(item.source_note, item.page_title, 'Terraria Wiki'),
        'imageUrl', item.image_url,
        'imageOriginalUrl', item.image_original_url,
        'imagePageUrl', item.image_page_url,
        'imageFile', item.image_file,
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

comment on column public.tracker_catalog_items.image_file is
  'Image filename returned by the Terraria Wiki Items Cargo imagefile field.';
comment on column public.tracker_catalog_items.image_url is
  'Direct thumbnail URL resolved from MediaWiki imageinfo for rendering in the app.';
comment on column public.tracker_catalog_items.image_original_url is
  'Original image URL on Terraria Wiki.';
comment on column public.tracker_catalog_items.image_page_url is
  'Terraria Wiki File page URL for attribution and source inspection.';

comment on column public.tracker_catalog_items.equipment_effect is
  'Per-item equipment effect or tooltip extracted from Terraria Wiki Cargo.';
comment on column public.tracker_catalog_items.armor_set_id is
  'Stable identifier of a curated class-specific armor set.';
comment on column public.tracker_catalog_items.armor_set_name is
  'Display name for the armor set grouping.';
comment on column public.tracker_catalog_items.armor_set_bonus is
  'Full-set bonus text for the class-specific armor set.';
comment on column public.tracker_catalog_items.buff_name is
  'Buff granted by an equipped item or armor set, when present.';
comment on column public.tracker_catalog_items.buff_duration is
  'Duration of an equipment buff, when applicable.';
