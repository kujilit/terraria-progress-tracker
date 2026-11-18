-- Terraria Progress Tracker — world administration v1
-- Run after 001_initial_schema.sql in Supabase SQL Editor.

alter table public.tracker_players
  drop constraint if exists tracker_players_role_check;

alter table public.tracker_players
  add constraint tracker_players_role_check
  check (role in ('owner', 'admin', 'member'));

create or replace function public.tracker_player_set_admin(
  p_token text,
  p_player_id uuid,
  p_is_admin boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_target public.tracker_players%rowtype;
  v_new_role text;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then
    raise exception using errcode = '28000',
      message = 'UNAUTHORIZED: Session is invalid or expired. Sign in again.';
  end if;

  -- Only the original world creator may grant or revoke administrator rights.
  if v_ctx.player_role <> 'owner' then
    raise exception using errcode = '42501',
      message = 'FORBIDDEN: Only the world creator can manage administrators.';
  end if;

  if p_player_id is null or p_is_admin is null then
    raise exception using errcode = '22023',
      message = 'VALIDATION_ERROR: Player and admin flag are required.';
  end if;

  select * into v_target
  from public.tracker_players
  where id = p_player_id and world_id = v_ctx.world_id
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'PLAYER_NOT_FOUND: Player is not a member of this world.';
  end if;

  if v_target.role = 'owner' then
    raise exception using errcode = '22023',
      message = 'VALIDATION_ERROR: The world creator role cannot be changed.';
  end if;

  v_new_role := case when p_is_admin then 'admin' else 'member' end;

  update public.tracker_players
  set role = v_new_role
  where id = v_target.id
  returning * into v_target;

  insert into public.tracker_audit_log
    (world_id, actor_id, action, entity_type, entity_id, before_json, after_json)
  values (
    v_ctx.world_id, v_ctx.player_id,
    case when p_is_admin then 'player.promoteAdmin' else 'player.revokeAdmin' end,
    'Player', v_target.id::text,
    jsonb_build_object('role', case when p_is_admin then 'member' else 'admin' end),
    jsonb_build_object('role', v_new_role)
  );

  return jsonb_build_object(
    'id', v_target.id,
    'name', v_target.name,
    'gameClass', v_target.game_class,
    'role', v_target.role
  );
end;
$$;

revoke all on function public.tracker_player_set_admin(text, uuid, boolean) from public;
grant execute on function public.tracker_player_set_admin(text, uuid, boolean) to anon, authenticated;
