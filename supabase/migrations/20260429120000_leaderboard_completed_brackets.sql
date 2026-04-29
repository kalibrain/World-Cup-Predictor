-- Leaderboard visibility is limited to locked tournaments and participants
-- who completed a bracket before lockout. Completed brackets are also the only
-- rows shown to users after lockout.

create or replace function public.bracket_is_complete(p_bracket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.brackets b
    join public.bracket_knockout_picks bkp on bkp.bracket_id = b.id
    where b.id = p_bracket_id
      and length(trim(b.name)) > 0
      and (
        select count(*)
        from public.bracket_group_rankings bgr
        where bgr.bracket_id = b.id
          and jsonb_typeof(bgr.rankings) = 'array'
          and jsonb_array_length(bgr.rankings) = 4
      ) >= 12
      and jsonb_typeof(bkp.selected_third_place) = 'array'
      and jsonb_array_length(bkp.selected_third_place) = 8
      and bkp.total_goals is not null
      and length(trim(coalesce(bkp.top_scorer, ''))) > 0
      and jsonb_typeof(bkp.matches) = 'object'
      and (
        select count(*)
        from jsonb_each(bkp.matches) as m(match_id, match_json)
        where m.match_json->>'winnerId' is not null
          and m.match_json->>'winnerId' <> ''
      ) >= 32
  );
$$;

drop function if exists public.get_tournament_leaderboard(uuid);
create or replace function public.get_tournament_leaderboard(p_tournament_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  bracket_id uuid,
  bracket_name text,
  predicted_total_goals integer,
  predicted_top_scorer text,
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
declare
  v_edition_id uuid;
  v_is_locked boolean;
begin
  if not public.user_can_access_tournament(p_tournament_id, auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select t.edition_id, now() >= t.locks_at
    into v_edition_id, v_is_locked
  from public.tournaments t
  where t.id = p_tournament_id;

  if v_edition_id is null then
    raise exception 'Tournament not found';
  end if;

  if not v_is_locked then
    raise exception 'Leaderboard is not available until lockout.';
  end if;

  if not exists (
    select 1
    from public.brackets viewer_bracket
    where viewer_bracket.tournament_id = p_tournament_id
      and viewer_bracket.user_id = auth.uid()
      and public.bracket_is_complete(viewer_bracket.id)
  ) then
    raise exception 'Only participants with a completed bracket can view the leaderboard.';
  end if;

  return query
  with pg as (
    select gp.group_id, gp.rankings
    from public.tournament_group_results_published gp
    where gp.edition_id = v_edition_id
  ),
  pm as (
    select mp.match_id, mp.winner_id
    from public.tournament_match_results_published mp
    where mp.edition_id = v_edition_id
      and mp.winner_id is not null
  ),
  ub as (
    select b.id as bracket_id, b.user_id, b.name as bracket_name
    from public.brackets b
    where b.tournament_id = p_tournament_id
      and public.bracket_is_complete(b.id)
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
      bkp.total_goals as predicted_total_goals,
      bkp.top_scorer as predicted_top_scorer,
      coalesce(gp2.group_points, 0) as group_points,
      coalesce(kp.knockout_points, 0) as knockout_points,
      (coalesce(gp2.group_points, 0) + coalesce(kp.knockout_points, 0)) as total_points
    from ub
    join public.bracket_knockout_picks bkp on bkp.bracket_id = ub.bracket_id
    left join group_points_per_bracket gp2 on gp2.bracket_id = ub.bracket_id
    left join knockout_points_per_bracket kp on kp.bracket_id = ub.bracket_id
  )
  select
    s.user_id,
    p.display_name,
    p.email,
    s.bracket_id,
    s.bracket_name,
    s.predicted_total_goals,
    s.predicted_top_scorer,
    s.group_points,
    s.knockout_points,
    s.total_points,
    rank() over (order by s.total_points desc)::integer,
    (select pub.published_at
     from public.tournament_standings_publication pub
     where pub.edition_id = v_edition_id)
  from scored s
  left join public.profiles p on p.id = s.user_id
  order by s.total_points desc, p.display_name nulls last, p.email nulls last;
end;
$$;

grant execute on function public.get_tournament_leaderboard(uuid) to authenticated;

drop function if exists public.get_tournament_leaderboard_bracket(uuid, uuid);
create or replace function public.get_tournament_leaderboard_bracket(
  p_tournament_id uuid,
  p_bracket_id uuid
)
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
declare
  v_is_locked boolean;
begin
  if not public.user_can_access_tournament(p_tournament_id, auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select now() >= t.locks_at
    into v_is_locked
  from public.tournaments t
  where t.id = p_tournament_id;

  if v_is_locked is null then
    raise exception 'Tournament not found';
  end if;

  if not v_is_locked then
    raise exception 'Bracket predictions are not available until lockout.';
  end if;

  if not exists (
    select 1
    from public.brackets viewer_bracket
    where viewer_bracket.tournament_id = p_tournament_id
      and viewer_bracket.user_id = auth.uid()
      and public.bracket_is_complete(viewer_bracket.id)
  ) then
    raise exception 'Only participants with a completed bracket can view predictions.';
  end if;

  return query
  select
    b.id as bracket_id,
    b.tournament_id,
    b.user_id,
    b.name as bracket_name,
    b.current_step,
    b.furthest_step,
    coalesce(
      (select jsonb_object_agg(bgr.group_id, bgr.rankings)
       from public.bracket_group_rankings bgr
       where bgr.bracket_id = b.id),
      '{}'::jsonb
    ) as rankings,
    jsonb_build_object(
      'selected_third_place', coalesce(bkp.selected_third_place, '[]'::jsonb),
      'third_place_assignment', coalesce(bkp.third_place_assignment, '{}'::jsonb),
      'matches', coalesce(bkp.matches, '{}'::jsonb),
      'total_goals', bkp.total_goals,
      'top_scorer', coalesce(bkp.top_scorer, '')
    ) as knockout
  from public.brackets b
  join public.bracket_knockout_picks bkp on bkp.bracket_id = b.id
  where b.tournament_id = p_tournament_id
    and b.id = p_bracket_id
    and public.bracket_is_complete(b.id);
end;
$$;

grant execute on function public.get_tournament_leaderboard_bracket(uuid, uuid) to authenticated;
