-- Allow the Supabase client roles to call the team-notes RPCs.
-- The RPCs authenticate the application session token internally; they do not
-- rely on Supabase Auth. Keep direct table access restricted.
do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'tracker_notes_list',
        'tracker_note_save',
        'tracker_note_delete'
      )
  loop
    execute format('revoke all on function %s from public', v_function.signature);
    execute format('grant execute on function %s to anon, authenticated', v_function.signature);
  end loop;
end;
$$;
