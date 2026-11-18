-- Terraria Progress Tracker — remove players from a world
-- Run after 005_world_admin_roles.sql in Supabase SQL Editor.

alter table public.tracker_players
  add column if not exists kicked_at timestamptz;

-- Kicked players are no longer considered active sessions.
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
    and p.kicked_at is null
  limit 1;
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
as $
declare
  v_world_id uuid;
  v_player public.tracker_players%rowtype;
  v_attempts integer;
  v_data jsonb;
begin
  if coalesce(p_join_code, '') !~ '^[A-Za-z0-9]{8}create or replace function public.tracker_players_list(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_ctx record; v_result jsonb;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'gameClass', p.game_class, 'role', p.role
  ) order by p.created_at), '[]'::jsonb)
  into v_result
  from public.tracker_players p
  where p.world_id = v_ctx.world_id and p.kicked_at is null;

  return v_result;
end;
$$;

create or replace function public.tracker_player_remove(
  p_token text,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_target public.tracker_players%rowtype;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  if v_ctx.player_role not in ('owner', 'admin') then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator or an administrator can remove players.';
  end if;

  if p_player_id is null or p_player_id = v_ctx.player_id then
    raise exception using errcode = '22023',
      message = 'VALIDATION_ERROR: You cannot remove yourself from the world.';
  end if;

  select * into v_target
  from public.tracker_players
  where id = p_player_id
    and world_id = v_ctx.world_id
    and kicked_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'PLAYER_NOT_FOUND: Active player is not a member of this world.';
  end if;

  if v_target.role = 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: The world creator cannot be removed.';
  end if;

  if v_target.role = 'admin' and v_ctx.player_role <> 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator can remove another administrator.';
  end if;

  update public.tracker_players
  set kicked_at = now()
  where id = v_target.id;

  update public.tracker_sessions
  set revoked_at = coalesce(revoked_at, now())
  where player_id = v_target.id and revoked_at is null;

  insert into public.tracker_audit_log
    (world_id, actor_id, action, entity_type, entity_id, before_json, after_json)
  values (
    v_ctx.world_id, v_ctx.player_id, 'player.remove', 'Player', v_target.id::text,
    jsonb_build_object('name', v_target.name, 'role', v_target.role),
    jsonb_build_object('kickedAt', now())
  );

  return jsonb_build_object('playerId', v_target.id);
end;
$$;

revoke all on function public.tracker_player_remove(text, uuid) from public;
grant execute on function public.tracker_player_remove(text, uuid) to anon, authenticated;

revoke all on function public.tracker_players_list(text) from public;
grant execute on function public.tracker_players_list(text) to anon, authenticated;

     or length(btrim(coalesce(p_player_name, ''))) not between 2 and 24
     or coalesce(p_pin, '') !~ '^[0-9]{6,12}
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
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'gameClass', p.game_class, 'role', p.role
  ) order by p.created_at), '[]'::jsonb)
  into v_result
  from public.tracker_players p
  where p.world_id = v_ctx.world_id and p.kicked_at is null;

  return v_result;
end;
$$;

create or replace function public.tracker_player_remove(
  p_token text,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_target public.tracker_players%rowtype;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  if v_ctx.player_role not in ('owner', 'admin') then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator or an administrator can remove players.';
  end if;

  if p_player_id is null or p_player_id = v_ctx.player_id then
    raise exception using errcode = '22023',
      message = 'VALIDATION_ERROR: You cannot remove yourself from the world.';
  end if;

  select * into v_target
  from public.tracker_players
  where id = p_player_id
    and world_id = v_ctx.world_id
    and kicked_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'PLAYER_NOT_FOUND: Active player is not a member of this world.';
  end if;

  if v_target.role = 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: The world creator cannot be removed.';
  end if;

  if v_target.role = 'admin' and v_ctx.player_role <> 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator can remove another administrator.';
  end if;

  update public.tracker_players
  set kicked_at = now()
  where id = v_target.id;

  update public.tracker_sessions
  set revoked_at = coalesce(revoked_at, now())
  where player_id = v_target.id and revoked_at is null;

  insert into public.tracker_audit_log
    (world_id, actor_id, action, entity_type, entity_id, before_json, after_json)
  values (
    v_ctx.world_id, v_ctx.player_id, 'player.remove', 'Player', v_target.id::text,
    jsonb_build_object('name', v_target.name, 'role', v_target.role),
    jsonb_build_object('kickedAt', now())
  );

  return jsonb_build_object('playerId', v_target.id);
end;
$$;

revoke all on function public.tracker_player_remove(text, uuid) from public;
grant execute on function public.tracker_player_remove(text, uuid) to anon, authenticated;

revoke all on function public.tracker_players_list(text) from public;
grant execute on function public.tracker_players_list(text) to anon, authenticated;
 then
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

  if v_player.kicked_at is not null then
    return jsonb_build_object('success', false, 'data', null,
      'error', jsonb_build_object('code', 'PLAYER_REMOVED', 'message', 'You have been removed from this world.'));
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
$;

-- Do not expose kicked members in the active roster.
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
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'gameClass', p.game_class, 'role', p.role
  ) order by p.created_at), '[]'::jsonb)
  into v_result
  from public.tracker_players p
  where p.world_id = v_ctx.world_id and p.kicked_at is null;

  return v_result;
end;
$$;

create or replace function public.tracker_player_remove(
  p_token text,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_target public.tracker_players%rowtype;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  if v_ctx.player_role not in ('owner', 'admin') then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator or an administrator can remove players.';
  end if;

  if p_player_id is null or p_player_id = v_ctx.player_id then
    raise exception using errcode = '22023',
      message = 'VALIDATION_ERROR: You cannot remove yourself from the world.';
  end if;

  select * into v_target
  from public.tracker_players
  where id = p_player_id
    and world_id = v_ctx.world_id
    and kicked_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'PLAYER_NOT_FOUND: Active player is not a member of this world.';
  end if;

  if v_target.role = 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: The world creator cannot be removed.';
  end if;

  if v_target.role = 'admin' and v_ctx.player_role <> 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator can remove another administrator.';
  end if;

  update public.tracker_players
  set kicked_at = now()
  where id = v_target.id;

  update public.tracker_sessions
  set revoked_at = coalesce(revoked_at, now())
  where player_id = v_target.id and revoked_at is null;

  insert into public.tracker_audit_log
    (world_id, actor_id, action, entity_type, entity_id, before_json, after_json)
  values (
    v_ctx.world_id, v_ctx.player_id, 'player.remove', 'Player', v_target.id::text,
    jsonb_build_object('name', v_target.name, 'role', v_target.role),
    jsonb_build_object('kickedAt', now())
  );

  return jsonb_build_object('playerId', v_target.id);
end;
$$;

revoke all on function public.tracker_player_remove(text, uuid) from public;
grant execute on function public.tracker_player_remove(text, uuid) to anon, authenticated;

revoke all on function public.tracker_players_list(text) from public;
grant execute on function public.tracker_players_list(text) to anon, authenticated;

     or length(btrim(coalesce(p_player_name, ''))) not between 2 and 24
     or coalesce(p_pin, '') !~ '^[0-9]{6,12}create or replace function public.tracker_players_list(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_ctx record; v_result jsonb;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'gameClass', p.game_class, 'role', p.role
  ) order by p.created_at), '[]'::jsonb)
  into v_result
  from public.tracker_players p
  where p.world_id = v_ctx.world_id and p.kicked_at is null;

  return v_result;
end;
$$;

create or replace function public.tracker_player_remove(
  p_token text,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_target public.tracker_players%rowtype;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  if v_ctx.player_role not in ('owner', 'admin') then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator or an administrator can remove players.';
  end if;

  if p_player_id is null or p_player_id = v_ctx.player_id then
    raise exception using errcode = '22023',
      message = 'VALIDATION_ERROR: You cannot remove yourself from the world.';
  end if;

  select * into v_target
  from public.tracker_players
  where id = p_player_id
    and world_id = v_ctx.world_id
    and kicked_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'PLAYER_NOT_FOUND: Active player is not a member of this world.';
  end if;

  if v_target.role = 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: The world creator cannot be removed.';
  end if;

  if v_target.role = 'admin' and v_ctx.player_role <> 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator can remove another administrator.';
  end if;

  update public.tracker_players
  set kicked_at = now()
  where id = v_target.id;

  update public.tracker_sessions
  set revoked_at = coalesce(revoked_at, now())
  where player_id = v_target.id and revoked_at is null;

  insert into public.tracker_audit_log
    (world_id, actor_id, action, entity_type, entity_id, before_json, after_json)
  values (
    v_ctx.world_id, v_ctx.player_id, 'player.remove', 'Player', v_target.id::text,
    jsonb_build_object('name', v_target.name, 'role', v_target.role),
    jsonb_build_object('kickedAt', now())
  );

  return jsonb_build_object('playerId', v_target.id);
end;
$$;

revoke all on function public.tracker_player_remove(text, uuid) from public;
grant execute on function public.tracker_player_remove(text, uuid) to anon, authenticated;

revoke all on function public.tracker_players_list(text) from public;
grant execute on function public.tracker_players_list(text) to anon, authenticated;

     or length(btrim(coalesce(p_player_name, ''))) not between 2 and 24
     or coalesce(p_pin, '') !~ '^[0-9]{6,12}
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
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'gameClass', p.game_class, 'role', p.role
  ) order by p.created_at), '[]'::jsonb)
  into v_result
  from public.tracker_players p
  where p.world_id = v_ctx.world_id and p.kicked_at is null;

  return v_result;
end;
$$;

create or replace function public.tracker_player_remove(
  p_token text,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_target public.tracker_players%rowtype;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  if v_ctx.player_role not in ('owner', 'admin') then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator or an administrator can remove players.';
  end if;

  if p_player_id is null or p_player_id = v_ctx.player_id then
    raise exception using errcode = '22023',
      message = 'VALIDATION_ERROR: You cannot remove yourself from the world.';
  end if;

  select * into v_target
  from public.tracker_players
  where id = p_player_id
    and world_id = v_ctx.world_id
    and kicked_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'PLAYER_NOT_FOUND: Active player is not a member of this world.';
  end if;

  if v_target.role = 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: The world creator cannot be removed.';
  end if;

  if v_target.role = 'admin' and v_ctx.player_role <> 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator can remove another administrator.';
  end if;

  update public.tracker_players
  set kicked_at = now()
  where id = v_target.id;

  update public.tracker_sessions
  set revoked_at = coalesce(revoked_at, now())
  where player_id = v_target.id and revoked_at is null;

  insert into public.tracker_audit_log
    (world_id, actor_id, action, entity_type, entity_id, before_json, after_json)
  values (
    v_ctx.world_id, v_ctx.player_id, 'player.remove', 'Player', v_target.id::text,
    jsonb_build_object('name', v_target.name, 'role', v_target.role),
    jsonb_build_object('kickedAt', now())
  );

  return jsonb_build_object('playerId', v_target.id);
end;
$$;

revoke all on function public.tracker_player_remove(text, uuid) from public;
grant execute on function public.tracker_player_remove(text, uuid) to anon, authenticated;

revoke all on function public.tracker_players_list(text) from public;
grant execute on function public.tracker_players_list(text) to anon, authenticated;
 then
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

  if v_player.kicked_at is not null then
    return jsonb_build_object('success', false, 'data', null,
      'error', jsonb_build_object('code', 'PLAYER_REMOVED', 'message', 'You have been removed from this world.'));
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
$;

-- Do not expose kicked members in the active roster.
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
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'gameClass', p.game_class, 'role', p.role
  ) order by p.created_at), '[]'::jsonb)
  into v_result
  from public.tracker_players p
  where p.world_id = v_ctx.world_id and p.kicked_at is null;

  return v_result;
end;
$$;

create or replace function public.tracker_player_remove(
  p_token text,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_target public.tracker_players%rowtype;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  if v_ctx.player_role not in ('owner', 'admin') then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator or an administrator can remove players.';
  end if;

  if p_player_id is null or p_player_id = v_ctx.player_id then
    raise exception using errcode = '22023',
      message = 'VALIDATION_ERROR: You cannot remove yourself from the world.';
  end if;

  select * into v_target
  from public.tracker_players
  where id = p_player_id
    and world_id = v_ctx.world_id
    and kicked_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'PLAYER_NOT_FOUND: Active player is not a member of this world.';
  end if;

  if v_target.role = 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: The world creator cannot be removed.';
  end if;

  if v_target.role = 'admin' and v_ctx.player_role <> 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator can remove another administrator.';
  end if;

  update public.tracker_players
  set kicked_at = now()
  where id = v_target.id;

  update public.tracker_sessions
  set revoked_at = coalesce(revoked_at, now())
  where player_id = v_target.id and revoked_at is null;

  insert into public.tracker_audit_log
    (world_id, actor_id, action, entity_type, entity_id, before_json, after_json)
  values (
    v_ctx.world_id, v_ctx.player_id, 'player.remove', 'Player', v_target.id::text,
    jsonb_build_object('name', v_target.name, 'role', v_target.role),
    jsonb_build_object('kickedAt', now())
  );

  return jsonb_build_object('playerId', v_target.id);
end;
$$;

revoke all on function public.tracker_player_remove(text, uuid) from public;
grant execute on function public.tracker_player_remove(text, uuid) to anon, authenticated;

revoke all on function public.tracker_players_list(text) from public;
grant execute on function public.tracker_players_list(text) to anon, authenticated;
 then
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

  if v_player.kicked_at is not null then
    return jsonb_build_object('success', false, 'data', null,
      'error', jsonb_build_object('code', 'PLAYER_REMOVED', 'message', 'You have been removed from this world.'));
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
$;

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
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'gameClass', p.game_class, 'role', p.role
  ) order by p.created_at), '[]'::jsonb)
  into v_result
  from public.tracker_players p
  where p.world_id = v_ctx.world_id and p.kicked_at is null;

  return v_result;
end;
$$;

create or replace function public.tracker_player_remove(
  p_token text,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_target public.tracker_players%rowtype;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  if v_ctx.player_role not in ('owner', 'admin') then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator or an administrator can remove players.';
  end if;

  if p_player_id is null or p_player_id = v_ctx.player_id then
    raise exception using errcode = '22023',
      message = 'VALIDATION_ERROR: You cannot remove yourself from the world.';
  end if;

  select * into v_target
  from public.tracker_players
  where id = p_player_id
    and world_id = v_ctx.world_id
    and kicked_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'PLAYER_NOT_FOUND: Active player is not a member of this world.';
  end if;

  if v_target.role = 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: The world creator cannot be removed.';
  end if;

  if v_target.role = 'admin' and v_ctx.player_role <> 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator can remove another administrator.';
  end if;

  update public.tracker_players
  set kicked_at = now()
  where id = v_target.id;

  update public.tracker_sessions
  set revoked_at = coalesce(revoked_at, now())
  where player_id = v_target.id and revoked_at is null;

  insert into public.tracker_audit_log
    (world_id, actor_id, action, entity_type, entity_id, before_json, after_json)
  values (
    v_ctx.world_id, v_ctx.player_id, 'player.remove', 'Player', v_target.id::text,
    jsonb_build_object('name', v_target.name, 'role', v_target.role),
    jsonb_build_object('kickedAt', now())
  );

  return jsonb_build_object('playerId', v_target.id);
end;
$$;

revoke all on function public.tracker_player_remove(text, uuid) from public;
grant execute on function public.tracker_player_remove(text, uuid) to anon, authenticated;

revoke all on function public.tracker_players_list(text) from public;
grant execute on function public.tracker_players_list(text) to anon, authenticated;

     or length(btrim(coalesce(p_player_name, ''))) not between 2 and 24
     or coalesce(p_pin, '') !~ '^[0-9]{6,12}
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
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'gameClass', p.game_class, 'role', p.role
  ) order by p.created_at), '[]'::jsonb)
  into v_result
  from public.tracker_players p
  where p.world_id = v_ctx.world_id and p.kicked_at is null;

  return v_result;
end;
$$;

create or replace function public.tracker_player_remove(
  p_token text,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_target public.tracker_players%rowtype;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  if v_ctx.player_role not in ('owner', 'admin') then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator or an administrator can remove players.';
  end if;

  if p_player_id is null or p_player_id = v_ctx.player_id then
    raise exception using errcode = '22023',
      message = 'VALIDATION_ERROR: You cannot remove yourself from the world.';
  end if;

  select * into v_target
  from public.tracker_players
  where id = p_player_id
    and world_id = v_ctx.world_id
    and kicked_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'PLAYER_NOT_FOUND: Active player is not a member of this world.';
  end if;

  if v_target.role = 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: The world creator cannot be removed.';
  end if;

  if v_target.role = 'admin' and v_ctx.player_role <> 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator can remove another administrator.';
  end if;

  update public.tracker_players
  set kicked_at = now()
  where id = v_target.id;

  update public.tracker_sessions
  set revoked_at = coalesce(revoked_at, now())
  where player_id = v_target.id and revoked_at is null;

  insert into public.tracker_audit_log
    (world_id, actor_id, action, entity_type, entity_id, before_json, after_json)
  values (
    v_ctx.world_id, v_ctx.player_id, 'player.remove', 'Player', v_target.id::text,
    jsonb_build_object('name', v_target.name, 'role', v_target.role),
    jsonb_build_object('kickedAt', now())
  );

  return jsonb_build_object('playerId', v_target.id);
end;
$$;

revoke all on function public.tracker_player_remove(text, uuid) from public;
grant execute on function public.tracker_player_remove(text, uuid) to anon, authenticated;

revoke all on function public.tracker_players_list(text) from public;
grant execute on function public.tracker_players_list(text) to anon, authenticated;
 then
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

  if v_player.kicked_at is not null then
    return jsonb_build_object('success', false, 'data', null,
      'error', jsonb_build_object('code', 'PLAYER_REMOVED', 'message', 'You have been removed from this world.'));
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
$;

-- Do not expose kicked members in the active roster.
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
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'gameClass', p.game_class, 'role', p.role
  ) order by p.created_at), '[]'::jsonb)
  into v_result
  from public.tracker_players p
  where p.world_id = v_ctx.world_id and p.kicked_at is null;

  return v_result;
end;
$$;

create or replace function public.tracker_player_remove(
  p_token text,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_target public.tracker_players%rowtype;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  if v_ctx.player_role not in ('owner', 'admin') then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator or an administrator can remove players.';
  end if;

  if p_player_id is null or p_player_id = v_ctx.player_id then
    raise exception using errcode = '22023',
      message = 'VALIDATION_ERROR: You cannot remove yourself from the world.';
  end if;

  select * into v_target
  from public.tracker_players
  where id = p_player_id
    and world_id = v_ctx.world_id
    and kicked_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'PLAYER_NOT_FOUND: Active player is not a member of this world.';
  end if;

  if v_target.role = 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: The world creator cannot be removed.';
  end if;

  if v_target.role = 'admin' and v_ctx.player_role <> 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator can remove another administrator.';
  end if;

  update public.tracker_players
  set kicked_at = now()
  where id = v_target.id;

  update public.tracker_sessions
  set revoked_at = coalesce(revoked_at, now())
  where player_id = v_target.id and revoked_at is null;

  insert into public.tracker_audit_log
    (world_id, actor_id, action, entity_type, entity_id, before_json, after_json)
  values (
    v_ctx.world_id, v_ctx.player_id, 'player.remove', 'Player', v_target.id::text,
    jsonb_build_object('name', v_target.name, 'role', v_target.role),
    jsonb_build_object('kickedAt', now())
  );

  return jsonb_build_object('playerId', v_target.id);
end;
$$;

revoke all on function public.tracker_player_remove(text, uuid) from public;
grant execute on function public.tracker_player_remove(text, uuid) to anon, authenticated;

revoke all on function public.tracker_players_list(text) from public;
grant execute on function public.tracker_players_list(text) to anon, authenticated;
