-- Qualify column references in standings RPCs: the published_at name in
-- RETURNS TABLE shadows the same-named table columns inside subqueries and
-- Postgres reports "column reference 'published_at' is ambiguous". Aliasing
-- the source tables and qualifying every column resolves it.

create or replace function public.admin_get_standings_editor(p_tournament_id uuid)
returns table (
  draft_group_results jsonb,
  draft_match_results jsonb,
  published_group_results jsonb,
  published_match_results jsonb,
  published_at timestamptz,
  draft_updated_at timestamptz
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
      (select jsonb_object_agg(gp.group_id, gp.rankings)
       from public.tournament_group_results_published gp
       where gp.tournament_id = p_tournament_id),
      '{}'::jsonb
    ),
    coalesce(
      (select jsonb_object_agg(mp.match_id, mp.winner_id)
       from public.tournament_match_results_published mp
       where mp.tournament_id = p_tournament_id),
      '{}'::jsonb
    ),
    (select pub.published_at
     from public.tournament_standings_publication pub
     where pub.tournament_id = p_tournament_id),
    (select greatest(
       coalesce((select max(g2.updated_at)
                 from public.tournament_group_results g2
                 where g2.tournament_id = p_tournament_id), 'epoch'::timestamptz),
       coalesce((select max(m2.updated_at)
                 from public.tournament_match_results m2
                 where m2.tournament_id = p_tournament_id), 'epoch'::timestamptz)
     ));
end;
$$;

grant execute on function public.admin_get_standings_editor(uuid) to authenticated;

create or replace function public.get_tournament_published_standings(p_tournament_id uuid)
returns table (
  group_results jsonb,
  match_results jsonb,
  published_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
begin
  if not public.user_can_access_tournament(p_tournament_id, auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    coalesce(
      (select jsonb_object_agg(gp.group_id, gp.rankings)
       from public.tournament_group_results_published gp
       where gp.tournament_id = p_tournament_id),
      '{}'::jsonb
    ),
    coalesce(
      (select jsonb_object_agg(mp.match_id, mp.winner_id)
       from public.tournament_match_results_published mp
       where mp.tournament_id = p_tournament_id),
      '{}'::jsonb
    ),
    (select pub.published_at
     from public.tournament_standings_publication pub
     where pub.tournament_id = p_tournament_id);
end;
$$;

grant execute on function public.get_tournament_published_standings(uuid) to authenticated;

create or replace function public.get_tournament_leaderboard(p_tournament_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  bracket_id uuid,
  bracket_name text,
  group_points integer,
  knockout_points integer,
  total_points integer,
  rank_position integer,
  published_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
begin
  if not public.user_can_access_tournament(p_tournament_id, auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
  with pg as (
    select gp.group_id, gp.rankings
    from public.tournament_group_results_published gp
    where gp.tournament_id = p_tournament_id
  ),
  pm as (
    select mp.match_id, mp.winner_id
    from public.tournament_match_results_published mp
    where mp.tournament_id = p_tournament_id
      and mp.winner_id is not null
  ),
  ub as (
    select b.id as bracket_id, b.user_id, b.name as bracket_name
    from public.brackets b
    where b.tournament_id = p_tournament_id
  ),
  group_points_per_bracket as (
    select
      ub.bracket_id,
      coalesce(sum(
        (case when bgr.rankings->>0 = pg.rankings->>0 then 5 else 0 end) +
        (case when bgr.rankings->>1 = pg.rankings->>1 then 5 else 0 end) +
        (case when bgr.rankings->>2 = pg.rankings->>2 then 5 else 0 end) +
        (case when bgr.rankings->>3 = pg.rankings->>3 then 5 else 0 end)
      ), 0)::integer as group_points
    from ub
    left join public.bracket_group_rankings bgr on bgr.bracket_id = ub.bracket_id
    left join pg on pg.group_id = bgr.group_id
    group by ub.bracket_id
  ),
  knockout_points_per_bracket as (
    select
      ub.bracket_id,
      coalesce((
        select sum(
          case when (bkp.matches->pm.match_id->>'winnerId') = pm.winner_id
               then 10 else 0 end
        )
        from public.bracket_knockout_picks bkp
        cross join pm
        where bkp.bracket_id = ub.bracket_id
      ), 0)::integer as knockout_points
    from ub
  ),
  scored as (
    select
      ub.user_id,
      ub.bracket_id,
      ub.bracket_name,
      coalesce(gp2.group_points, 0) as group_points,
      coalesce(kp.knockout_points, 0) as knockout_points,
      (coalesce(gp2.group_points, 0) + coalesce(kp.knockout_points, 0)) as total_points
    from ub
    left join group_points_per_bracket gp2 on gp2.bracket_id = ub.bracket_id
    left join knockout_points_per_bracket kp on kp.bracket_id = ub.bracket_id
  )
  select
    s.user_id,
    p.display_name,
    p.email,
    s.bracket_id,
    s.bracket_name,
    s.group_points,
    s.knockout_points,
    s.total_points,
    rank() over (order by s.total_points desc)::integer,
    (select pub.published_at
     from public.tournament_standings_publication pub
     where pub.tournament_id = p_tournament_id)
  from scored s
  left join public.profiles p on p.id = s.user_id
  order by s.total_points desc, p.display_name nulls last, p.email nulls last;
end;
$$;

grant execute on function public.get_tournament_leaderboard(uuid) to authenticated;
