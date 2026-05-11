create or replace function public.admin_delete_bracket(p_bracket_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_global_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  delete from public.bracket_group_rankings
  where bracket_id = p_bracket_id;

  delete from public.bracket_knockout_picks
  where bracket_id = p_bracket_id;

  delete from public.brackets
  where id = p_bracket_id;
end;
$$;

grant execute on function public.admin_delete_bracket(uuid) to authenticated;
