-- Shared team notes and lightweight backlog.
create table if not exists public.tracker_world_notes (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.tracker_worlds(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  body text not null default '' check (length(body) <= 10000),
  status text not null default 'backlog' check (status in ('backlog','doing','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  created_by uuid not null references public.tracker_players(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.tracker_world_note_players (
  note_id uuid not null references public.tracker_world_notes(id) on delete cascade,
  player_id uuid not null references public.tracker_players(id) on delete cascade,
  primary key(note_id, player_id)
);
create index if not exists tracker_world_notes_world_updated_idx
  on public.tracker_world_notes(world_id, updated_at desc);
alter table public.tracker_world_notes enable row level security;
alter table public.tracker_world_note_players enable row level security;
revoke all on public.tracker_world_notes, public.tracker_world_note_players from public, anon, authenticated;

create or replace function public.tracker_notes_list(p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_ctx record; v_result jsonb;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then raise exception using errcode='28000', message='UNAUTHORIZED: Session is invalid or expired.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'title', n.title, 'body', n.body, 'status', n.status,
    'priority', n.priority, 'createdBy', n.created_by, 'createdAt', n.created_at,
    'updatedAt', n.updated_at,
    'playerIds', coalesce((select jsonb_agg(np.player_id) from public.tracker_world_note_players np where np.note_id=n.id),'[]'::jsonb)
  ) order by case n.status when 'doing' then 0 when 'backlog' then 1 else 2 end,
    case n.priority when 'high' then 0 when 'normal' then 1 else 2 end, n.updated_at desc),'[]'::jsonb)
  into v_result from public.tracker_world_notes n where n.world_id=v_ctx.world_id;
  return v_result;
end; $$;

create or replace function public.tracker_note_save(
  p_token text, p_note_id uuid, p_title text, p_body text,
  p_status text, p_priority text, p_player_ids uuid[] default '{}'
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_ctx record; v_note_id uuid; v_result jsonb;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then raise exception using errcode='28000', message='UNAUTHORIZED: Session is invalid or expired.'; end if;
  if length(btrim(coalesce(p_title,''))) not between 1 and 120
     or length(coalesce(p_body,'')) > 10000
     or coalesce(p_status,'') not in ('backlog','doing','done')
     or coalesce(p_priority,'') not in ('low','normal','high') then
    raise exception using errcode='22023', message='VALIDATION_ERROR: Check note title, text, status and priority.';
  end if;
  if p_note_id is null then
    insert into public.tracker_world_notes(world_id,title,body,status,priority,created_by)
    values(v_ctx.world_id,btrim(p_title),coalesce(p_body,''),p_status,p_priority,v_ctx.player_id)
    returning id into v_note_id;
  else
    update public.tracker_world_notes set title=btrim(p_title),body=coalesce(p_body,''),
      status=p_status,priority=p_priority,updated_at=now()
    where id=p_note_id and world_id=v_ctx.world_id returning id into v_note_id;
    if v_note_id is null then raise exception using errcode='P0002', message='NOTE_NOT_FOUND: Note does not belong to this world.'; end if;
  end if;
  delete from public.tracker_world_note_players where note_id=v_note_id;
  insert into public.tracker_world_note_players(note_id,player_id)
  select v_note_id,p.id from public.tracker_players p
  where p.world_id=v_ctx.world_id and p.kicked_at is null and p.id=any(coalesce(p_player_ids,'{}'::uuid[]))
  on conflict do nothing;
  select jsonb_build_object('id',n.id,'title',n.title,'body',n.body,'status',n.status,
    'priority',n.priority,'createdBy',n.created_by,'createdAt',n.created_at,'updatedAt',n.updated_at,
    'playerIds',coalesce((select jsonb_agg(np.player_id) from public.tracker_world_note_players np where np.note_id=n.id),'[]'::jsonb))
  into v_result from public.tracker_world_notes n where n.id=v_note_id;
  return v_result;
end; $$;

create or replace function public.tracker_note_delete(p_token text,p_note_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_ctx record; v_deleted boolean;
begin
  select * into v_ctx from private.tracker_session_context(p_token);
  if not found then raise exception using errcode='28000', message='UNAUTHORIZED: Session is invalid or expired.'; end if;
  delete from public.tracker_world_notes where id=p_note_id and world_id=v_ctx.world_id;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('deleted',v_deleted);
end; $$;

revoke all on function public.tracker_notes_list(text) from public, anon;
revoke all on function public.tracker_note_save(text,uuid,text,text,text,text,uuid[]) from public, anon;
revoke all on function public.tracker_note_delete(text,uuid) from public, anon;
grant execute on function public.tracker_notes_list(text) to authenticated, service_role;
grant execute on function public.tracker_note_save(text,uuid,text,text,text,text,uuid[]) to authenticated, service_role;
grant execute on function public.tracker_note_delete(text,uuid) to authenticated, service_role;
