-- Fix "column reference tournament_id is ambiguous" in
-- admin_list_tournaments_overview(). In PL/pgSQL RETURNS TABLE functions,
-- unqualified names can collide with output column names.

create or replace function public.admin_list_tournaments_overview()
returns table (
  tournament_id uuid,
  tournament_name text,
  visibility public.tournament_visibility,
  status public.tournament_status,
  starts_at timestamptz,
  locks_at timestamptz,
  is_locked boolean,
  edition_id uuid,
  edition_name text,
  member_count bigint,
  bracket_count bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
begin
  if not public.is_global_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
  with members as (
    select tm.tournament_id as tid, count(*) as cnt
    from public.tournament_memberships tm
    group by tm.tournament_id
  ),
  brackets_count as (
    select b.tournament_id as tid, count(*) as cnt
    from public.brackets b
    group by b.tournament_id
  )
  select
    t.id,
    t.name,
    t.visibility,
    t.status,
    t.starts_at,
    t.locks_at,
    now() >= t.locks_at,
    t.edition_id,
    e.name,
    coalesce(m.cnt, 0),
    coalesce(bc.cnt, 0),
    t.created_at
  from public.tournaments t
  left join public.tournament_editions e on e.id = t.edition_id
  left join members m on m.tid = t.id
  left join brackets_count bc on bc.tid = t.id
  order by t.created_at desc;
end;
$$;

grant execute on function public.admin_list_tournaments_overview() to authenticated;
