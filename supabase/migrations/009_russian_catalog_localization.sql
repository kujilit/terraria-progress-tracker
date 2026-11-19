-- Russian Terraria names for the persisted Supabase catalog.
-- Stable item_key / boss_id values are deliberately not changed.

create table if not exists public.tracker_boss_localizations (
  boss_id text primary key,
  name_en text not null,
  name_ru text not null,
  stage_ru text,
  source_url text not null default 'https://terraria.fandom.com/ru/wiki/Боссы'
);

insert into public.tracker_boss_localizations (boss_id, name_en, name_ru, stage_ru)
values
  ('eye', 'Eye of Cthulhu', 'Глаз Ктулху', 'До хардмода'),
  ('eater', 'Eater of Worlds / Brain of Cthulhu', 'Пожиратель миров / Мозг Ктулху', 'До хардмода'),
  ('skeletron', 'Skeletron', 'Скелетрон', 'До хардмода'),
  ('wof', 'Wall of Flesh', 'Стена плоти', 'Хардмод'),
  ('destroyer', 'The Destroyer', 'Уничтожитель', 'Хардмод'),
  ('twins', 'The Twins', 'Близнецы', 'Хардмод'),
  ('skeletron_prime', 'Skeletron Prime', 'Скелетрон Прайм', 'Хардмод'),
  ('plantera', 'Plantera', 'Плантера', 'Хардмод'),
  ('golem', 'Golem', 'Голем', 'Хардмод'),
  ('cultist', 'Lunatic Cultist', 'Лунатик-культист', 'Эндгейм'),
  ('moon_lord', 'Moon Lord', 'Лунный повелитель', 'Эндгейм'),
  ('king_slime', 'King Slime', 'Король слизней', 'До хардмода'),
  ('queen_bee', 'Queen Bee', 'Королева пчёл', 'До хардмода'),
  ('deerclops', 'Deerclops', 'Олень-циклоп', 'До хардмода'),
  ('dreadnautilus', 'Dreadnautilus', 'Дредноутилус', 'Хардмод'),
  ('duke_fishron', 'Duke Fishron', 'Герцог Рыбокрыл', 'Хардмод'),
  ('empress_of_light', 'Empress of Light', 'Императрица света', 'Хардмод')
on conflict (boss_id) do update set
  name_en = excluded.name_en,
  name_ru = excluded.name_ru,
  stage_ru = excluded.stage_ru;

alter table public.tracker_boss_localizations enable row level security;
revoke all on public.tracker_boss_localizations from public, anon, authenticated;
grant select on public.tracker_boss_localizations to service_role;

with translations(name_en, name_ru) as (
  values
    ('Night''s Edge', 'Грань ночи'),
    ('Muramasa', 'Мурамаса'),
    ('Blade of Grass', 'Клинок травы'),
    ('Fiery Greatsword', 'Огненный двуручник'),
    ('Terra Blade', 'Терра-клинок'),
    ('True Night''s Edge', 'Истинная грань ночи'),
    ('True Excalibur', 'Истинный Экскалибур'),
    ('Broken Hero Sword', 'Сломанный меч героя'),
    ('Excalibur', 'Экскалибур'),
    ('Megashark', 'Мегакула'),
    ('Meteor Staff', 'Метеоритный посох'),
    ('Spider Staff', 'Паучий посох'),
    ('Mothron', 'Мотрон'),
    ('Hellstone Bars', 'Слитки адского камня'),
    ('Hallowed Bars', 'Освящённые слитки'),
    ('Warrior Emblem', 'Эмблема воина'),
    ('Platinum Armor', 'Платиновая броня'),
    ('Gi', 'Ги'),
    ('Starfury', 'Звёздная ярость'),
    ('Terragrim', 'Террагрим'),
    ('Amazon', 'Амазония'),
    ('Molten Armor', 'Адская броня'),
    ('Titanium Armor', 'Титановая броня'),
    ('Hallowed Armor', 'Освящённая броня'),
    ('Turtle Armor', 'Черепашья броня'),
    ('Beetle Armor', 'Жучья броня'),
    ('Solar Eruption', 'Солнечный выброс'),
    ('Zenith', 'Зенит'),
    ('Fossil Armor', 'Ископаемая броня'),
    ('Minishark', 'Мини-акула'),
    ('Demon Bow', 'Демонический лук'),
    ('Necro Armor', 'Некро-броня'),
    ('Bee''s Knees', 'Пчелиные колени'),
    ('Frost Armor', 'Ледяная броня'),
    ('Daedalus Stormbow', 'Штормовой лук Дедала'),
    ('Chlorophyte Armor', 'Хлорофитовая броня'),
    ('Pulse Bow', 'Импульсный лук'),
    ('Shroomite Armor', 'Грибная броня'),
    ('Tsunami', 'Цунами'),
    ('Sniper Rifle', 'Снайперская винтовка'),
    ('Vortex Armor', 'Броня вихря'),
    ('Phantasm', 'Фантазм'),
    ('Jungle Armor', 'Броня джунглей'),
    ('Diamond Staff', 'Алмазный посох'),
    ('Meteor Armor', 'Метеоритная броня'),
    ('Space Gun', 'Космическая пушка'),
    ('Flamelash', 'Огненная плеть'),
    ('Rainbow Rod', 'Радужный жезл'),
    ('Venom Staff', 'Ядовитый посох'),
    ('Spectre Armor', 'Спектральная броня'),
    ('Razorblade Typhoon', 'Бритвенный тайфун'),
    ('Blizzard Staff', 'Посох метели'),
    ('Nebula Armor', 'Броня туманности'),
    ('Last Prism', 'Последняя призма'),
    ('Leather Whip', 'Кожаный хлыст'),
    ('Snapthorn', 'Шипохват'),
    ('Spinal Tap', 'Спинной кирдык'),
    ('Firecracker', 'Сварщик'),
    ('Durendal', 'Дюрандаль'),
    ('Dark Harvest', 'Тёмная жатва'),
    ('Morning Star', 'Утренняя звезда'),
    ('Kaleidoscope', 'Калейдоскоп'),
    ('Flinx Fur Coat', 'Шуба Флинкса'),
    ('Flinx Staff', 'Посох Флинкса'),
    ('Abigail''s Flower', 'Цветок Эбигейл'),
    ('Bee Armor', 'Пчелиная броня'),
    ('Hornet Staff', 'Посох шершней'),
    ('Obsidian Armor', 'Обсидиановая броня'),
    ('Imp Staff', 'Посох беса'),
    ('Spider Armor', 'Паучья броня'),
    ('Cool Whip', 'Охлаждающий хлыст'),
    ('Spooky Armor', 'Жуткая броня'),
    ('Tiki Armor', 'Броня тики'),
    ('Pygmy Staff', 'Посох пигмеев'),
    ('Xeno Staff', 'Ксено-посох'),
    ('Tempest Staff', 'Посох смерча'),
    ('Stardust Armor', 'Броня звёздной пыли'),
    ('Stardust Dragon Staff', 'Посох дракона звёздной пыли'),
    ('Mechanical Glove', 'Механическая перчатка'),
    ('Fire Gauntlet', 'Огненная перчатка'),
    ('Destroyer Emblem', 'Эмблема разрушителя'),
    ('Celestial Shell', 'Небесная раковина'),
    ('Master Ninja Gear', 'Снаряжение мастера-ниндзя'),
    ('Berserker''s Glove', 'Перчатка берсерка'),
    ('Frozen Shield', 'Замороженный щит'),
    ('Terraspark Boots', 'Терра-искрящиеся ботинки'),
    ('Ankh Shield', 'Щит Анкха'),
    ('Worm Scarf', 'Шарф червя'),
    ('Charm of Myths', 'Амулет мифов'),
    ('Ranger Emblem', 'Эмблема стрелка'),
    ('Recon Scope', 'Разведывательный прицел'),
    ('Sniper Scope', 'Снайперский прицел'),
    ('Chaos Cylinder', 'Цилиндр хаоса'),
    ('Magic Quiver', 'Волшебный колчан'),
    ('Stalker''s Quiver', 'Колчан охотника'),
    ('Sorcerer Emblem', 'Эмблема мага'),
    ('Celestial Emblem', 'Небесная эмблема'),
    ('Arcane Flower', 'Магический цветок'),
    ('Mana Cloak', 'Мантия маны'),
    ('Celestial Cuffs', 'Небесные наручи'),
    ('Mystic Arts Sash', 'Пояс мистических искусств'),
    ('Restoration Shield', 'Щит восстановления'),
    ('Summoner Emblem', 'Эмблема призывателя'),
    ('Papyrus Scarab', 'Папирусный скарабей'),
    ('Pygmy Necklace', 'Карликовое ожерелье'),
    ('Avenger Emblem', 'Эмблема мстителя'),
    ('Twilight Grasp', 'Сумеречная хватка'),
    ('Ouroboros Ring', 'Кольцо Уробороса'),
    ('Wicked Claws', 'Зловещие когти'),
    ('King Slime', 'Король слизней'),
    ('Eye of Cthulhu', 'Глаз Ктулху'),
    ('Eater of Worlds', 'Пожиратель миров'),
    ('Brain of Cthulhu', 'Мозг Ктулху'),
    ('Skeletron', 'Скелетрон'),
    ('Wall of Flesh', 'Стена плоти'),
    ('The Destroyer', 'Уничтожитель'),
    ('The Twins', 'Близнецы'),
    ('Skeletron Prime', 'Скелетрон Прайм'),
    ('Plantera', 'Плантера'),
    ('Golem', 'Голем'),
    ('Lunatic Cultist', 'Лунатик-культист'),
    ('Moon Lord', 'Лунный повелитель'),
    ('Queen Slime', 'Королева слизней'),
    ('Queen Bee', 'Королева пчёл'),
    ('Deerclops', 'Олень-циклоп'),
    ('Dreadnautilus', 'Дредноутилус'),
    ('Duke Fishron', 'Герцог Рыбокрыл'),
    ('Empress of Light', 'Императрица света'),
    ('Demon / Crimson Altar', 'Алтарь демонов / кровавый алтарь'),
    ('Mythril / Orichalcum Anvil', 'Мифриловая / орихалковая наковальня'),
    ('Dungeon chest', 'Сундук в Данже'),
    ('Crafting', 'Изготовление'),
    ('Spider Caves', 'Паучьи пещеры')
)
update public.tracker_catalog_items item
set name_ru = translations.name_ru
from translations
where lower(item.name) = lower(translations.name_en)
  and (item.name_ru is null or item.name_ru = '' or item.name_ru = item.name);

-- Translate recipe-facing strings while retaining source names in raw_cargo.
with translations(name_en, name_ru) as (
  values
    ('Demon / Crimson Altar', 'Алтарь демонов / кровавый алтарь'),
    ('Mythril / Orichalcum Anvil', 'Мифриловая / орихалковая наковальня'),
    ('Dungeon chest', 'Сундук в Данже'),
    ('Crafting', 'Изготовление'),
    ('Spider Caves', 'Паучьи пещеры')
)
update public.tracker_catalog_recipes r
set crafting_station = translations.name_ru
from translations
where lower(r.crafting_station) = lower(translations.name_en);

with translations(name_en, name_ru) as (
  values
    ('Hellstone Bars', 'Слитки адского камня'),
    ('Hallowed Bars', 'Освящённые слитки'),
    ('Broken Hero Sword', 'Сломанный меч героя'),
    ('Demon / Crimson Altar', 'Алтарь демонов / кровавый алтарь'),
    ('Mythril / Orichalcum Anvil', 'Мифриловая / орихалковая наковальня')
)
update public.tracker_catalog_recipe_ingredients ingredient
set ingredient_name = translations.name_ru
from translations
where lower(ingredient.ingredient_name) = lower(translations.name_en);
