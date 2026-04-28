-- Fix "column reference edition_id is ambiguous" in
-- admin_list_editions_overview(). In PL/pgSQL RETURNS TABLE functions,
-- unqualified names can collide with output column names.

create or replace function public.admin_list_editions_overview()
returns table (
  edition_id uuid,
  edition_name text,
  tournament_count bigint,
  results_groups_entered bigint,
  results_matches_entered bigint,
  tiebreakers_entered boolean,
  published_at timestamptz,
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
  with tournament_counts as (
    select t.edition_id as eid, count(*) as cnt
    from public.tournaments t
    group by t.edition_id
  ),
  group_result_counts as (
    select gr.edition_id as eid, count(*) as cnt
    from public.tournament_group_results gr
    group by gr.edition_id
  ),
  match_result_counts as (
    select mr.edition_id as eid, count(*) as cnt
    from public.tournament_match_results mr
    where mr.winner_id is not null
    group by mr.edition_id
  )
  select
    e.id,
    e.name,
    coalesce(tc.cnt, 0),
    coalesce(grc.cnt, 0),
    coalesce(mrc.cnt, 0),
    (tb.edition_id is not null),
    pub.published_at,
    e.created_at
  from public.tournament_editions e
  left join tournament_counts tc on tc.eid = e.id
  left join group_result_counts grc on grc.eid = e.id
  left join match_result_counts mrc on mrc.eid = e.id
  left join public.tournament_tiebreakers tb on tb.edition_id = e.id
  left join public.tournament_standings_publication pub on pub.edition_id = e.id
  order by e.created_at;
end;
$$;

grant execute on function public.admin_list_editions_overview() to authenticated;
