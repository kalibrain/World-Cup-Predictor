-- Fix "column reference is ambiguous" errors: in PL/pgSQL functions with
-- RETURNS TABLE, an unqualified column name in the body can clash with a
-- declared output column of the same name. Re-issue the affected functions
-- with every column reference qualified by its table alias.

create or replace function public.admin_list_tournaments_overview()
returns table (
  tournament_id uuid,
  tournament_name text,
  visibility public.tournament_visibility,
  status public.tournament_status,
  starts_at timestamptz,
  locks_at timestamptz,
  is_locked boolean,
  member_count bigint,
  bracket_count bigint,
  results_groups_entered bigint,
  results_matches_entered bigint,
  tiebreakers_entered boolean,
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
  ),
  group_res as (
    select g.tournament_id as tid, count(*) as cnt
    from public.tournament_group_results g
    group by g.tournament_id
  ),
  match_res as (
    select mr.tournament_id as tid, count(*) as cnt
    from public.tournament_match_results mr
    where mr.winner_id is not null
    group by mr.tournament_id
  )
  select
    t.id,
    t.name,
    t.visibility,
    t.status,
    t.starts_at,
    t.locks_at,
    now() >= t.locks_at,
    coalesce(m.cnt, 0),
    coalesce(b.cnt, 0),
    coalesce(g.cnt, 0),
    coalesce(mt.cnt, 0),
    (tb.tournament_id is not null),
    t.created_at
  from public.tournaments t
  left join members m on m.tid = t.id
  left join brackets_count b on b.tid = t.id
  left join group_res g on g.tid = t.id
  left join match_res mt on mt.tid = t.id
  left join public.tournament_tiebreakers tb on tb.tournament_id = t.id
  order by t.created_at desc;
end;
$$;

create or replace function public.admin_get_bracket(p_bracket_id uuid)
returns table (
  bracket_id uuid,
  tournament_id uuid,
  user_id uuid,
  bracket_name text,
  current_step text,
  furthest_step text,
  rankings jsonb,
  knockout jsonb
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
  select
    b.id,
    b.tournament_id,
    b.user_id,
    b.name,
    b.current_step,
    b.furthest_step,
    coalesce(
      (select jsonb_object_agg(r.group_id, r.rankings)
       from public.bracket_group_rankings r
       where r.bracket_id = b.id),
      '{}'::jsonb
    ),
    coalesce(
      (select to_jsonb(k) - 'bracket_id' - 'id' - 'updated_at'
       from public.bracket_knockout_picks k
       where k.bracket_id = b.id),
      '{}'::jsonb
    )
  from public.brackets b
  where b.id = p_bracket_id;
end;
$$;

create or replace function public.admin_get_tournament_results(p_tournament_id uuid)
returns table (
  group_results jsonb,
  match_results jsonb,
  tiebreakers jsonb
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
  select
    coalesce(
      (select jsonb_object_agg(g.group_id, g.rankings)
       from public.tournament_group_results g
       where g.tournament_id = p_tournament_id),
      '{}'::jsonb
    ),
    coalesce(
      (select jsonb_object_agg(m.match_id, m.winner_id)
       from public.tournament_match_results m
       where m.tournament_id = p_tournament_id),
      '{}'::jsonb
    ),
    coalesce(
      (select to_jsonb(tb) - 'tournament_id'
       from public.tournament_tiebreakers tb
       where tb.tournament_id = p_tournament_id),
      'null'::jsonb
    );
end;
$$;
