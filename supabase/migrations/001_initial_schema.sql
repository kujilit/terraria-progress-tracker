-- Terraria Progress Tracker — Supabase schema v1
-- Run the whole file once in Supabase Dashboard -> SQL Editor.
-- Tables are not directly accessible from the browser. The client can call only
-- the narrow RPC functions defined below. All mutations run in PostgreSQL transactions.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.tracker_worlds (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique,
  name text not null,
  game_version text not null default '1.4.5.x',
  difficulty text not null default 'Master',
  evil_biome text not null default 'Crimson',
  seed text not null default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.tracker_players (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.tracker_worlds(id) on delete cascade,
  name text not null,
  game_class text not null check (game_class in ('Melee', 'Ranger', 'Mage', 'Summoner')),
  role text not null default 'member' check (role in ('owner', 'member')),
  pin_hash text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists tracker_players_world_name_uidx
  on public.tracker_players (world_id, lower(name));

create table if not exists public.tracker_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  world_id uuid not null references public.tracker_worlds(id) on delete cascade,
  player_id uuid not null references public.tracker_players(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tracker_sessions_active_idx
  on public.tracker_sessions (token_hash, expires_at)
  where revoked_at is null;

create table if not exists public.tracker_player_items (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.tracker_worlds(id) on delete cascade,
  player_id uuid not null references public.tracker_players(id) on delete cascade,
  item_id text not null,
  status text not null check (status in ('owned', 'planned', 'crafting', 'missing', 'skipped')),
  quantity integer not null default 0 check (quantity between 0 and 999),
  updated_at timestamptz not null default now(),
  unique (world_id, player_id, item_id)
);

create table if not exists public.tracker_world_bosses (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.tracker_worlds(id) on delete cascade,
  boss_id text not null,
  status text not null check (status in ('defeated', 'pending')),
  defeated_at timestamptz,
  updated_by uuid not null references public.tracker_players(id),
  unique (world_id, boss_id)
);

create table if not exists public.tracker_team_inventory (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.tracker_worlds(id) on delete cascade,
  player_id uuid not null references public.tracker_players(id) on delete cascade,
  item_id text not null,
  quantity integer not null default 0 check (quantity between 0 and 99999),
  reserved_quantity integer not null default 0 check (reserved_quantity between 0 and 99999),
  updated_at timestamptz not null default now(),
  unique (world_id, player_id, item_id),
  check (quantity >= reserved_quantity)
);

create table if not exists public.tracker_item_transfers (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.tracker_worlds(id) on delete cascade,
  from_player_id uuid not null references public.tracker_players(id),
  to_player_id uuid not null references public.tracker_players(id),
  item_id text not null,
  quantity integer not null check (quantity > 0),
  status text not null default 'completed' check (status in ('completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.tracker_inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.tracker_worlds(id) on delete cascade,
  player_id uuid not null references public.tracker_players(id),
  item_id text not null,
  delta integer not null,
  reason text not null,
  idempotency_key text,
  transfer_id uuid references public.tracker_item_transfers(id),
  created_at timestamptz not null default now()
);

create unique index if not exists tracker_inventory_idempotency_uidx
  on public.tracker_inventory_transactions (world_id, player_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.tracker_audit_log (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.tracker_worlds(id) on delete cascade,
  actor_id uuid not null references public.tracker_players(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tracker_player_items_world_idx on public.tracker_player_items (world_id);
create index if not exists tracker_world_bosses_world_idx on public.tracker_world_bosses (world_id);
create index if not exists tracker_team_inventory_world_idx on public.tracker_team_inventory (world_id);

-- All data tables are private to the RPC layer. RLS is enabled as a second barrier.
alter table public.tracker_worlds enable row level security;
alter table public.tracker_players enable row level security;
alter table public.tracker_sessions enable row level security;
alter table public.tracker_player_items enable row level security;
alter table public.tracker_world_bosses enable row level security;
alter table public.tracker_team_inventory enable row level security;
alter table public.tracker_item_transfers enable row level security;
alter table public.tracker_inventory_transactions enable row level security;
alter table public.tracker_audit_log enable row level security;

revoke all privileges on table
  public.tracker_worlds,
  public.tracker_players,
  public.tracker_sessions,
  public.tracker_player_items,
  public.tracker_world_bosses,
  public.tracker_team_inventory,
  public.tracker_item_transfers,
  public.tracker_inventory_transactions,
  public.tracker_audit_log
from public, anon, authenticated;

-- Private helper: resolve a random bearer token into its active player/world.
create or replace function private.tracker_session_context(p_token text)
returns table (
  session_id uuid,
  world_id uuid,
  player_id uuid,
  player_name text,
  game_class text,
  player_role text,
  world_name text,
  join_code text,
  game_version text,
  difficulty text,
  evil_biome text,
  seed text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, w.id, p.id, p.name, p.game_class, p.role,
    w.name, w.join_code, w.game_version, w.difficulty, w.evil_biome, w.seed
  from public.tracker_sessions s
  join public.tracker_worlds w on w.id = s.world_id and w.status = 'active'
  join public.tracker_players p on p.id = s.player_id and p.world_id = w.id
  where p_token is not null
    and length(p_token) between 40 and 200
    and s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and s.revoked_at is null
    and s.expires_at > now()
  limit 1;
$$;

-- Private helper: create a 12-hour session and return the one-time raw token.
create or replace function private.tracker_make_session(p_world_id uuid, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at timestamptz := now() + interval '12 hours';
  v_result jsonb;
begin
  insert into public.tracker_sessions (token_hash, world_id, player_id, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), p_world_id, p_player_id, v_expires_at);

  select jsonb_build_object(
    'token', v_token,
    'expiresAt', v_expires_at,
    'world', jsonb_build_object(
      'id', w.id, 'name', w.name, 'joinCode', w.join_code,
      'gameVersion', w.game_version, 'difficulty', w.difficulty,
      'evilBiome', w.evil_biome, 'seed', w.seed
    ),
    'player', jsonb_build_object(
      'id', p.id, 'name', p.name, 'gameClass', p.game_class, 'role', p.role
    )
  )
  into v_result
  from public.tracker_worlds w
  join public.tracker_players p on p.world_id = w.id
  where w.id = p_world_id and p.id = p_player_id;

  return v_result;
end;
$$;

create or replace function public.tracker_health()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object('status', 'ok', 'apiVersion', 'supabase-v1');
$$;

create or replace function public.tracker_world_create(
  p_world_name text,
  p_player_name text,
  p_pin text,
  p_game_class text,
  p_game_version text default '1.4.5.x',
  p_difficulty text default 'Master',
  p_evil_biome text default 'Crimson',
  p_seed text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_world_id uuid;
  v_player_id uuid;
  v_join_code text;
begin
  if length(btrim(coalesce(p_world_name, ''))) not between 2 and 48
     or length(btrim(coalesce(p_player_name, ''))) not between 2 and 24
     or coalesce(p_pin, '') !~ '^[0-9]{6,12}$'
     or coalesce(p_game_class, '') not in ('Melee', 'Ranger', 'Mage', 'Summoner') then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR: Check world name, player name, PIN and class.';
  end if;

  if length(btrim(coalesce(p_game_version, ''))) not between 1 and 20
     or length(btrim(coalesce(p_difficulty, ''))) not between 1 and 24
     or length(btrim(coalesce(p_evil_biome, ''))) not between 1 and 24
     or length(coalesce(p_seed, '')) > 80 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR: World settings are invalid.';
  end if;

  v_join_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8));
  insert into public.tracker_worlds (join_code, name, game_version, difficulty, evil_biome, seed)
  values (v_join_code, btrim(p_world_name), btrim(coalesce(p_game_version, '1.4.5.x')),
          btrim(coalesce(p_difficulty, 'Master')), btrim(coalesce(p_evil_biome, 'Crimson')),
          coalesce(p_seed, ''))
  returning id into v_world_id;

  insert into public.tracker_players (world_id, name, game_class, role, pin_hash)
  values (v_world_id, btrim(p_player_name), p_game_class,
          'owner', extensions.crypt(p_pin, extensions.gen_salt('bf', 12)))
  returning id into v_player_id;

  insert into public.tracker_audit_log (world_id, actor_id, action, entity_type, entity_id, after_json)
  values (v_world_id, v_player_id, 'world.create', 'World', v_world_id::text,
          jsonb_build_object('name', btrim(p_world_name)));

  return private.tracker_make_session(v_world_id, v_player_id);
end;
$$;

create or replace function public.tracker_world_join(
  p_join_code text,
  p_player_name text,
  p_pin text,
  p_game_class text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_world_id uuid;
  v_player_id uuid;
  v_code text := upper(btrim(coalesce(p_join_code, '')));
begin
  if v_code !~ '^[A-Z0-9]{8}$'
     or length(btrim(coalesce(p_player_name, ''))) not between 2 and 24
     or coalesce(p_pin, '') !~ '^[0-9]{6,12}$'
     or coalesce(p_game_class, '') not in ('Melee', 'Ranger', 'Mage', 'Summoner') then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR: Check world code, player name, PIN and class.';
  end if;

  select id into v_world_id
  from public.tracker_worlds
  where join_code = v_code and status = 'active';

  if v_world_id is null then
    raise exception using errcode = 'P0001', message = 'WORLD_NOT_FOUND: World code is invalid or the world is inactive.';
  end if;

  insert into public.tracker_players (world_id, name, game_class, role, pin_hash)
  values (v_world_id, btrim(p_player_name), p_game_class, 'member',
          extensions.crypt(p_pin, extensions.gen_salt('bf', 12)))
  returning id into v_player_id;

  insert into public.tracker_audit_log (world_id, actor_id, action, entity_type, entity_id, after_json)
  values (v_world_id, v_player_id, 'world.join', 'Player', v_player_id::text,
          jsonb_build_object('name', btrim(p_player_name)));

  return private.tracker_make_session(v_world_id, v_player_id);
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'PLAYER_EXISTS: A player with this name already belongs to the world.';
end;
$$;

create or replace function public.tracker_auth_login(
  p_join_code text,
  p_player_name text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_world_id uuid;
  v_player public.tracker_players%rowtype;
  v_attempts integer;
  v_data jsonb;
begin
  if coalesce(p_join_code, '') !~ '^[A-Za-z0-9]{8}$'
     or length(btrim(coalesce(p_player_name, ''))) not between 2 and 24
     or coalesce(p_pin, '') !~ '^[0-9]{6,12}$' then
    return jsonb_build_object('success', false, 'data', null,
      'error', jsonb_build_object('code', 'AUTH_FAILED', 'message', 'World code, player name, or PIN is incorrect.'));
  end if;

  select id into v_world_id
  from public.tracker_worlds
  where join_code = upper(btrim(p_join_code)) and status = 'active';

  if v_world_id is null then
    return jsonb_build_object('success', false, 'data', null,
      'error', jsonb_build_object('code', 'AUTH_FAILED', 'message', 'World code, player name, or PIN is incorrect.'));
  end if;

  select * into v_player
  from public.tracker_players
  where world_id = v_world_id and lower(name) = lower(btrim(p_player_name));

  if not found then
    return jsonb_build_object('success', false, 'data', null,
      'error', jsonb_build_object('code', 'AUTH_FAILED', 'message', 'World code, player name, or PIN is incorrect.'));
  end if;

  if v_player.locked_until is not null and v_player.locked_until > now() then
    return jsonb_build_object('success', false, 'data', null,
      'error', jsonb_build_object('code', 'LOGIN_LOCKED', 'message', 'Too many failed attempts. Try again later.'));
  end if;

  if extensions.crypt(p_pin, v_player.pin_hash) <> v_player.pin_hash then
    v_attempts := v_player.failed_attempts + 1;
    update public.tracker_players
    set failed_attempts = v_attempts,
        locked_until = case when v_attempts >= 5 then now() + interval '15 minutes' else null end
    where id = v_player.id;

    if v_attempts >= 5 then
      return jsonb_build_object('success', false, 'data', null,
        'error', jsonb_build_object('code', 'LOGIN_LOCKED', 'message', 'Too many failed attempts. Try again later.'));
    end if;

    return jsonb_build_object('success', false, 'data', null,
      'error', jsonb_build_object('code', 'AUTH_FAILED', 'message', 'World code, player name, or PIN is incorrect.'));
  end if;

  update public.tracker_players
  set failed_attempts = 0, locked_until = null
  where id = v_player.id;

  v_data := private.tracker_make_session(v_world_id, v_player.id);
  return jsonb_build_object('success', true, 'data', v_data, 'error', null);
end;
$$;

create or replace function public.tracker_auth_logout(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tracker_sessions
  set revoked_at = coalesce(revoked_at, now())
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return jsonb_build_object('loggedOut', true);
end;
$$;

create or replace function public.tracker_world_info(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_ctx record;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000', message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;
  return jsonb_build_object(
    'id', v_ctx.world_id, 'name', v_ctx.world_name, 'joinCode', v_ctx.join_code,
    'gameVersion', v_ctx.game_version, 'difficulty', v_ctx.difficulty,
    'evilBiome', v_ctx.evil_biome, 'seed', v_ctx.seed
  );
end;
$$;

create or replace function public.tracker_players_list(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_ctx record; v_result jsonb;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000', message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'gameClass', p.game_class, 'role', p.role
  ) order by p.created_at), '[]'::jsonb)
  into v_result
  from public.tracker_players p
  where p.world_id = v_ctx.world_id;

  return v_result;
end;
$$;

create or replace function public.tracker_progress_list(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_ctx record; v_result jsonb;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000', message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'worldId', r.world_id, 'playerId', r.player_id,
    'itemId', r.item_id, 'status', r.status, 'quantity', r.quantity,
    'updatedAt', r.updated_at
  ) order by r.updated_at desc), '[]'::jsonb)
  into v_result
  from public.tracker_player_items r
  where r.world_id = v_ctx.world_id;

  return v_result;
end;
$$;

create or replace function public.tracker_progress_set(
  p_token text, p_item_id text, p_status text, p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_ctx record; v_row public.tracker_player_items%rowtype;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000', message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;
  if coalesce(p_item_id, '') !~ '^[A-Za-z0-9_-]{1,120}$'
     or coalesce(p_status, '') not in ('owned', 'planned', 'crafting', 'missing', 'skipped')
     or p_quantity is null or p_quantity not between 0 and 999 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR: Item progress payload is invalid.';
  end if;

  insert into public.tracker_player_items (world_id, player_id, item_id, status, quantity, updated_at)
  values (v_ctx.world_id, v_ctx.player_id, p_item_id, p_status, p_quantity, now())
  on conflict (world_id, player_id, item_id)
  do update set status = excluded.status, quantity = excluded.quantity, updated_at = now()
  returning * into v_row;

  insert into public.tracker_audit_log (world_id, actor_id, action, entity_type, entity_id, after_json)
  values (v_ctx.world_id, v_ctx.player_id, 'progress.set', 'PlayerItem', p_item_id,
          jsonb_build_object('status', v_row.status, 'quantity', v_row.quantity));

  return jsonb_build_object(
    'id', v_row.id, 'worldId', v_row.world_id, 'playerId', v_row.player_id,
    'itemId', v_row.item_id, 'status', v_row.status, 'quantity', v_row.quantity,
    'updatedAt', v_row.updated_at
  );
end;
$$;

create or replace function public.tracker_bosses_list(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_ctx record; v_result jsonb;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000', message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'worldId', b.world_id, 'bossId', b.boss_id,
    'status', b.status, 'defeatedAt', coalesce(b.defeated_at::text, ''),
    'updatedBy', b.updated_by
  ) order by b.boss_id), '[]'::jsonb)
  into v_result
  from public.tracker_world_bosses b
  where b.world_id = v_ctx.world_id;

  return v_result;
end;
$$;

create or replace function public.tracker_boss_set_status(
  p_token text, p_boss_id text, p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_ctx record; v_row public.tracker_world_bosses%rowtype;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000', message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;
  if coalesce(p_boss_id, '') !~ '^[A-Za-z0-9_-]{1,120}$'
     or coalesce(p_status, '') not in ('defeated', 'pending') then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR: Boss status payload is invalid.';
  end if;

  insert into public.tracker_world_bosses (world_id, boss_id, status, defeated_at, updated_by)
  values (v_ctx.world_id, p_boss_id, p_status,
          case when p_status = 'defeated' then now() else null end, v_ctx.player_id)
  on conflict (world_id, boss_id)
  do update set status = excluded.status, defeated_at = excluded.defeated_at,
                updated_by = excluded.updated_by
  returning * into v_row;

  insert into public.tracker_audit_log (world_id, actor_id, action, entity_type, entity_id, after_json)
  values (v_ctx.world_id, v_ctx.player_id, 'boss.setStatus', 'Boss', p_boss_id,
          jsonb_build_object('status', v_row.status));

  return jsonb_build_object(
    'id', v_row.id, 'worldId', v_row.world_id, 'bossId', v_row.boss_id,
    'status', v_row.status, 'defeatedAt', coalesce(v_row.defeated_at::text, ''),
    'updatedBy', v_row.updated_by
  );
end;
$$;

create or replace function public.tracker_inventory_list(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_ctx record; v_result jsonb;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000', message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'worldId', i.world_id, 'playerId', i.player_id,
    'itemId', i.item_id, 'quantity', i.quantity,
    'reservedQuantity', i.reserved_quantity, 'updatedAt', i.updated_at
  ) order by i.updated_at desc), '[]'::jsonb)
  into v_result
  from public.tracker_team_inventory i
  where i.world_id = v_ctx.world_id;

  return v_result;
end;
$$;

create or replace function public.tracker_inventory_set(
  p_token text, p_item_id text, p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_row public.tracker_team_inventory%rowtype;
  v_old_quantity integer := 0;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000', message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;
  if coalesce(p_item_id, '') !~ '^[A-Za-z0-9_-]{1,120}$'
     or p_quantity is null or p_quantity not between 0 and 99999 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR: Inventory payload is invalid.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_ctx.world_id::text || ':' || v_ctx.player_id::text || ':' || p_item_id, 0
  ));

  select * into v_row
  from public.tracker_team_inventory
  where world_id = v_ctx.world_id and player_id = v_ctx.player_id and item_id = p_item_id
  for update;

  if found then
    v_old_quantity := v_row.quantity;
    if p_quantity < v_row.reserved_quantity then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK: Quantity cannot be lower than the reserved amount.';
    end if;
    update public.tracker_team_inventory
    set quantity = p_quantity, updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.tracker_team_inventory (world_id, player_id, item_id, quantity)
    values (v_ctx.world_id, v_ctx.player_id, p_item_id, p_quantity)
    returning * into v_row;
  end if;

  insert into public.tracker_inventory_transactions
    (world_id, player_id, item_id, delta, reason)
  values (v_ctx.world_id, v_ctx.player_id, p_item_id, p_quantity - v_old_quantity, 'manual_set');

  insert into public.tracker_audit_log (world_id, actor_id, action, entity_type, entity_id, after_json)
  values (v_ctx.world_id, v_ctx.player_id, 'inventory.set', 'TeamInventory', p_item_id,
          jsonb_build_object('quantity', v_row.quantity, 'reservedQuantity', v_row.reserved_quantity));

  return jsonb_build_object(
    'id', v_row.id, 'worldId', v_row.world_id, 'playerId', v_row.player_id,
    'itemId', v_row.item_id, 'quantity', v_row.quantity,
    'reservedQuantity', v_row.reserved_quantity, 'updatedAt', v_row.updated_at
  );
end;
$$;

create or replace function public.tracker_inventory_transfer(
  p_token text, p_to_player_id uuid, p_item_id text, p_quantity integer, p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_source public.tracker_team_inventory%rowtype;
  v_transfer_id uuid;
  v_existing_transfer_id uuid;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000', message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;
  if p_to_player_id is null or p_to_player_id = v_ctx.player_id
     or coalesce(p_item_id, '') !~ '^[A-Za-z0-9_-]{1,120}$'
     or p_quantity is null or p_quantity not between 1 and 99999
     or length(coalesce(p_idempotency_key, '')) not between 8 and 100 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR: Inventory transfer payload is invalid.';
  end if;

  -- Serialize retries of the same request and updates to the source item.
  perform pg_advisory_xact_lock(hashtextextended(
    v_ctx.world_id::text || ':transfer:' || v_ctx.player_id::text || ':' || p_idempotency_key, 0
  ));

  select transfer_id into v_existing_transfer_id
  from public.tracker_inventory_transactions
  where world_id = v_ctx.world_id
    and player_id = v_ctx.player_id
    and idempotency_key = p_idempotency_key
  limit 1;

  if v_existing_transfer_id is not null then
    return jsonb_build_object('duplicate', true, 'transferId', v_existing_transfer_id);
  end if;

  if not exists (
    select 1 from public.tracker_players
    where id = p_to_player_id and world_id = v_ctx.world_id
  ) then
    raise exception using errcode = 'P0001', message = 'PLAYER_NOT_FOUND: Target player is not a member of this world.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_ctx.world_id::text || ':' || v_ctx.player_id::text || ':' || p_item_id, 0
  ));

  select * into v_source
  from public.tracker_team_inventory
  where world_id = v_ctx.world_id and player_id = v_ctx.player_id and item_id = p_item_id
  for update;

  if not found or v_source.quantity - v_source.reserved_quantity < p_quantity then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK: Not enough unreserved items to transfer.';
  end if;

  v_transfer_id := gen_random_uuid();

  update public.tracker_team_inventory
  set quantity = quantity - p_quantity, updated_at = now()
  where id = v_source.id;

  insert into public.tracker_team_inventory (world_id, player_id, item_id, quantity, reserved_quantity)
  values (v_ctx.world_id, p_to_player_id, p_item_id, p_quantity, 0)
  on conflict (world_id, player_id, item_id)
  do update set quantity = public.tracker_team_inventory.quantity + excluded.quantity,
                updated_at = now();

  insert into public.tracker_item_transfers
    (id, world_id, from_player_id, to_player_id, item_id, quantity)
  values (v_transfer_id, v_ctx.world_id, v_ctx.player_id, p_to_player_id, p_item_id, p_quantity);

  insert into public.tracker_inventory_transactions
    (world_id, player_id, item_id, delta, reason, idempotency_key, transfer_id)
  values
    (v_ctx.world_id, v_ctx.player_id, p_item_id, -p_quantity, 'transfer:' || v_transfer_id::text,
     p_idempotency_key, v_transfer_id),
    (v_ctx.world_id, p_to_player_id, p_item_id, p_quantity, 'transfer_in:' || v_transfer_id::text,
     null, v_transfer_id);

  insert into public.tracker_audit_log (world_id, actor_id, action, entity_type, entity_id, after_json)
  values (v_ctx.world_id, v_ctx.player_id, 'inventory.transfer', 'ItemTransfer', v_transfer_id::text,
          jsonb_build_object('toPlayerId', p_to_player_id, 'itemId', p_item_id, 'quantity', p_quantity));

  return jsonb_build_object('duplicate', false, 'transferId', v_transfer_id);
end;
$$;

-- Expose only the RPC surface. Direct table access remains denied.
revoke all on function private.tracker_session_context(text) from public, anon, authenticated;
revoke all on function private.tracker_make_session(uuid, uuid) from public, anon, authenticated;

revoke all on function public.tracker_health() from public;
revoke all on function public.tracker_world_create(text, text, text, text, text, text, text, text) from public;
revoke all on function public.tracker_world_join(text, text, text, text) from public;
revoke all on function public.tracker_auth_login(text, text, text) from public;
revoke all on function public.tracker_auth_logout(text) from public;
revoke all on function public.tracker_world_info(text) from public;
revoke all on function public.tracker_players_list(text) from public;
revoke all on function public.tracker_progress_list(text) from public;
revoke all on function public.tracker_progress_set(text, text, text, integer) from public;
revoke all on function public.tracker_bosses_list(text) from public;
revoke all on function public.tracker_boss_set_status(text, text, text) from public;
revoke all on function public.tracker_inventory_list(text) from public;
revoke all on function public.tracker_inventory_set(text, text, integer) from public;
revoke all on function public.tracker_inventory_transfer(text, uuid, text, integer, text) from public;

grant execute on function public.tracker_health() to anon, authenticated;
grant execute on function public.tracker_world_create(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.tracker_world_join(text, text, text, text) to anon, authenticated;
grant execute on function public.tracker_auth_login(text, text, text) to anon, authenticated;
grant execute on function public.tracker_auth_logout(text) to anon, authenticated;
grant execute on function public.tracker_world_info(text) to anon, authenticated;
grant execute on function public.tracker_players_list(text) to anon, authenticated;
grant execute on function public.tracker_progress_list(text) to anon, authenticated;
grant execute on function public.tracker_progress_set(text, text, text, integer) to anon, authenticated;
grant execute on function public.tracker_bosses_list(text) to anon, authenticated;
grant execute on function public.tracker_boss_set_status(text, text, text) to anon, authenticated;
grant execute on function public.tracker_inventory_list(text) to anon, authenticated;
grant execute on function public.tracker_inventory_set(text, text, integer) to anon, authenticated;
grant execute on function public.tracker_inventory_transfer(text, uuid, text, integer, text) to anon, authenticated;

comment on schema private is 'Internal helper functions for Terraria Progress Tracker. Do not expose via Supabase Data API.';
comment on table public.tracker_sessions is 'Only SHA-256 hashes of random session tokens are stored. Raw tokens are returned once to the player.';
comment on table public.tracker_audit_log is 'Append-only audit trail for tracker mutations.';
