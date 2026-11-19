-- Disable automatic expiration for player sessions.
-- Existing non-revoked sessions remain valid; explicit logout and player/world
-- deletion continue to revoke or invalidate sessions as before.

alter table public.tracker_sessions
  alter column expires_at set default 'infinity'::timestamptz;

update public.tracker_sessions
set expires_at = 'infinity'::timestamptz
where revoked_at is null;

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
  limit 1;
$$;

create or replace function private.tracker_make_session(p_world_id uuid, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at timestamptz := 'infinity'::timestamptz;
  v_result jsonb;
begin
  insert into public.tracker_sessions (token_hash, world_id, player_id, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), p_world_id, p_player_id, v_expires_at);

  select jsonb_build_object(
    'token', v_token,
    'expiresAt', null,
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

comment on column public.tracker_sessions.expires_at is
  'Set to infinity for non-expiring sessions. Sessions end only through explicit logout, player deletion, or world deactivation/deletion.';
