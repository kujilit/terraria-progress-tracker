-- Shield of Cthulhu is an accessory, not armor.
-- Correct every imported catalog snapshot, including the currently published one.
update public.tracker_catalog_items
set
  primary_category = 'accessory',
  categories = array(
    select distinct category
    from unnest(array_append(array_remove(categories, 'armor'), 'accessory')) as category
    where category <> 'weapon'
    order by category
  ),
  icon = '💍'
where lower(name) = 'shield of cthulhu';
