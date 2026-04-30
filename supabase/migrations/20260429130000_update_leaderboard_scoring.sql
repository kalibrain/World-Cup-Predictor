-- Update leaderboard scoring to award points by round reached, ignoring path.
-- Adds published third-place qualifier selections so Round of 32 scoring can
-- distinguish the eight actual third-place teams from the four eliminated ones.

create table if not exists public.tournament_third_place_qualifiers (
  edition_id uuid primary key references public.tournament_editions(id) on delete cascade,
  group_ids jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_third_place_qualifiers_published (
  edition_id uuid primary key references public.tournament_editions(id) on delete cascade,
  group_ids jsonb not null default '[]'::jsonb,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now()
);

alter table public.tournament_third_place_qualifiers enable row level security;
alter table public.tournament_third_place_qualifiers_published enable row level security;

drop policy if exists tournament_third_place_qualifiers_select on public.tournament_third_place_qualifiers;
create policy tournament_third_place_qualifiers_select on public.tournament_third_place_qualifiers
  for select to authenticated
  using (
    public.is_global_admin(auth.uid())
    or exists (
      select 1
      from public.tournaments t
      where t.edition_id = tournament_third_place_qualifiers.edition_id
        and public.user_can_access_tournament(t.id, auth.uid())
    )
  );

drop policy if exists tournament_third_place_qualifiers_admin_write on public.tournament_third_place_qualifiers;
create policy tournament_third_place_qualifiers_admin_write on public.tournament_third_place_qualifiers
  for all to authenticated
  using (public.is_global_admin(auth.uid()))
  with check (public.is_global_admin(auth.uid()));

drop policy if exists tournament_third_place_qualifiers_pub_select on public.tournament_third_place_qualifiers_published;
create policy tournament_third_place_qualifiers_pub_select on public.tournament_third_place_qualifiers_published
  for select to authenticated
  using (
    public.is_global_admin(auth.uid())
    or exists (
      select 1
      from public.tournaments t
      where t.edition_id = tournament_third_place_qualifiers_published.edition_id
        and public.user_can_access_tournament(t.id, auth.uid())
    )
  );

drop policy if exists tournament_third_place_qualifiers_pub_admin_write on public.tournament_third_place_qualifiers_published;
create policy tournament_third_place_qualifiers_pub_admin_write on public.tournament_third_place_qualifiers_published
  for all to authenticated
  using (public.is_global_admin(auth.uid()))
  with check (public.is_global_admin(auth.uid()));

grant select, insert, update, delete on public.tournament_third_place_qualifiers to authenticated;
grant select, insert, update, delete on public.tournament_third_place_qualifiers_published to authenticated;

drop function if exists public.admin_upsert_third_place_qualifiers(uuid, jsonb);
create or replace function public.admin_upsert_third_place_qualifiers(
  p_edition_id uuid,
  p_group_ids jsonb
)
returns public.tournament_third_place_qualifiers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.tournament_third_place_qualifiers;
begin
  if not public.is_global_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if jsonb_typeof(coalesce(p_group_ids, '[]'::jsonb)) <> 'array' then
    raise exception 'Third-place qualifiers must be an array';
  end if;

  if jsonb_array_length(coalesce(p_group_ids, '[]'::jsonb)) > 8 then
    raise exception 'Choose at most 8 third-place qualifiers';
  end if;

  insert into public.tournament_third_place_qualifiers (edition_id, group_ids, updated_by)
  values (p_edition_id, coalesce(p_group_ids, '[]'::jsonb), auth.uid())
  on conflict (edition_id)
  do update set
    group_ids = excluded.group_ids,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_upsert_third_place_qualifiers(uuid, jsonb) to authenticated;

drop function if exists public.admin_get_standings_editor(uuid);
create or replace function public.admin_get_standings_editor(p_edition_id uuid)
returns table (
  draft_group_results jsonb,
  draft_match_results jsonb,
  draft_third_place_qualifiers jsonb,
  published_group_results jsonb,
  published_match_results jsonb,
  published_third_place_qualifiers jsonb,
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
       where g.edition_id = p_edition_id),
      '{}'::jsonb
    ),
    coalesce(
      (select jsonb_object_agg(m.match_id, m.winner_id)
       from public.tournament_match_results m
       where m.edition_id = p_edition_id),
      '{}'::jsonb
    ),
    coalesce(
      (select q.group_ids
       from public.tournament_third_place_qualifiers q
       where q.edition_id = p_edition_id),
      '[]'::jsonb
    ),
    coalesce(
      (select jsonb_object_agg(gp.group_id, gp.rankings)
       from public.tournament_group_results_published gp
       where gp.edition_id = p_edition_id),
      '{}'::jsonb
    ),
    coalesce(
      (select jsonb_object_agg(mp.match_id, mp.winner_id)
       from public.tournament_match_results_published mp
       where mp.edition_id = p_edition_id),
      '{}'::jsonb
    ),
    coalesce(
      (select qp.group_ids
       from public.tournament_third_place_qualifiers_published qp
       where qp.edition_id = p_edition_id),
      '[]'::jsonb
    ),
    (select pub.published_at
     from public.tournament_standings_publication pub
     where pub.edition_id = p_edition_id),
    (select greatest(
       coalesce((select max(g2.updated_at)
                 from public.tournament_group_results g2
                 where g2.edition_id = p_edition_id), 'epoch'::timestamptz),
       coalesce((select max(m2.updated_at)
                 from public.tournament_match_results m2
                 where m2.edition_id = p_edition_id), 'epoch'::timestamptz),
       coalesce((select q2.updated_at
                 from public.tournament_third_place_qualifiers q2
                 where q2.edition_id = p_edition_id), 'epoch'::timestamptz)
     ));
end;
$$;

grant execute on function public.admin_get_standings_editor(uuid) to authenticated;

drop function if exists public.admin_publish_standings_update(uuid);
create or replace function public.admin_publish_standings_update(p_edition_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
begin
  if not public.is_global_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  delete from public.tournament_group_results_published
  where edition_id = p_edition_id;

  insert into public.tournament_group_results_published
    (edition_id, group_id, rankings, published_at, published_by)
  select edition_id, group_id, rankings, v_now, auth.uid()
  from public.tournament_group_results
  where edition_id = p_edition_id;

  delete from public.tournament_match_results_published
  where edition_id = p_edition_id;

  insert into public.tournament_match_results_published
    (edition_id, match_id, winner_id, published_at, published_by)
  select edition_id, match_id, winner_id, v_now, auth.uid()
  from public.tournament_match_results
  where edition_id = p_edition_id;

  delete from public.tournament_third_place_qualifiers_published
  where edition_id = p_edition_id;

  insert into public.tournament_third_place_qualifiers_published
    (edition_id, group_ids, published_at, published_by)
  select edition_id, group_ids, v_now, auth.uid()
  from public.tournament_third_place_qualifiers
  where edition_id = p_edition_id;

  insert into public.tournament_standings_publication (edition_id, published_at, published_by)
  values (p_edition_id, v_now, auth.uid())
  on conflict (edition_id)
  do update set published_at = excluded.published_at, published_by = excluded.published_by;

  return v_now;
end;
$$;

grant execute on function public.admin_publish_standings_update(uuid) to authenticated;

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
  v_actual_total_goals integer;
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

  select tb.total_goals into v_actual_total_goals
  from public.tournament_tiebreakers tb
  where tb.edition_id = v_edition_id;

  return query
  with published_groups as (
    select gp.group_id, gp.rankings
    from public.tournament_group_results_published gp
    where gp.edition_id = v_edition_id
  ),
  published_matches as (
    select mp.match_id, mp.winner_id
    from public.tournament_match_results_published mp
    where mp.edition_id = v_edition_id
      and mp.winner_id is not null
  ),
  published_third_groups as (
    select jsonb_array_elements_text(qp.group_ids) as group_id
    from public.tournament_third_place_qualifiers_published qp
    where qp.edition_id = v_edition_id
  ),
  actual_round_teams as (
    select 'R32'::text as round_key, pg.rankings->>0 as team_id
    from published_groups pg
    union
    select 'R32', pg.rankings->>1
    from published_groups pg
    union
    select 'R32', pg.rankings->>2
    from published_groups pg
    join published_third_groups ptg on ptg.group_id = pg.group_id
    union
    select 'R16', pm.winner_id
    from published_matches pm
    where pm.match_id in ('M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12','M13','M14','M15','M16')
    union
    select 'QF', pm.winner_id
    from published_matches pm
    where pm.match_id in ('R16_1','R16_2','R16_3','R16_4','R16_5','R16_6','R16_7','R16_8')
    union
    select 'SF', pm.winner_id
    from published_matches pm
    where pm.match_id in ('QF1','QF2','QF3','QF4')
    union
    select 'FINAL', pm.winner_id
    from published_matches pm
    where pm.match_id in ('SF1','SF2')
    union
    select 'CHAMPION', pm.winner_id
    from published_matches pm
    where pm.match_id = 'FINAL'
  ),
  ub as (
    select b.id as bracket_id, b.user_id, b.name as bracket_name
    from public.brackets b
    where b.tournament_id = p_tournament_id
      and public.bracket_is_complete(b.id)
  ),
  predicted_round_teams as (
    select distinct ub.bracket_id, 'R32'::text as round_key, team_id
    from ub
    join public.bracket_knockout_picks bkp on bkp.bracket_id = ub.bracket_id
    cross join lateral jsonb_array_elements(jsonb_build_array(
      bkp.matches->'M1'->'slot1'->>'teamId', bkp.matches->'M1'->'slot2'->>'teamId',
      bkp.matches->'M2'->'slot1'->>'teamId', bkp.matches->'M2'->'slot2'->>'teamId',
      bkp.matches->'M3'->'slot1'->>'teamId', bkp.matches->'M3'->'slot2'->>'teamId',
      bkp.matches->'M4'->'slot1'->>'teamId', bkp.matches->'M4'->'slot2'->>'teamId',
      bkp.matches->'M5'->'slot1'->>'teamId', bkp.matches->'M5'->'slot2'->>'teamId',
      bkp.matches->'M6'->'slot1'->>'teamId', bkp.matches->'M6'->'slot2'->>'teamId',
      bkp.matches->'M7'->'slot1'->>'teamId', bkp.matches->'M7'->'slot2'->>'teamId',
      bkp.matches->'M8'->'slot1'->>'teamId', bkp.matches->'M8'->'slot2'->>'teamId',
      bkp.matches->'M9'->'slot1'->>'teamId', bkp.matches->'M9'->'slot2'->>'teamId',
      bkp.matches->'M10'->'slot1'->>'teamId', bkp.matches->'M10'->'slot2'->>'teamId',
      bkp.matches->'M11'->'slot1'->>'teamId', bkp.matches->'M11'->'slot2'->>'teamId',
      bkp.matches->'M12'->'slot1'->>'teamId', bkp.matches->'M12'->'slot2'->>'teamId',
      bkp.matches->'M13'->'slot1'->>'teamId', bkp.matches->'M13'->'slot2'->>'teamId',
      bkp.matches->'M14'->'slot1'->>'teamId', bkp.matches->'M14'->'slot2'->>'teamId',
      bkp.matches->'M15'->'slot1'->>'teamId', bkp.matches->'M15'->'slot2'->>'teamId',
      bkp.matches->'M16'->'slot1'->>'teamId', bkp.matches->'M16'->'slot2'->>'teamId'
    )) as r32(team_id_json)
    cross join lateral (select r32.team_id_json #>> '{}' as team_id) v
    where v.team_id is not null and v.team_id <> ''
    union
    select ub.bracket_id, 'R16', m.winner_id
    from ub
    join public.bracket_knockout_picks bkp on bkp.bracket_id = ub.bracket_id
    cross join lateral (values
      (bkp.matches->'M1'->>'winnerId'), (bkp.matches->'M2'->>'winnerId'),
      (bkp.matches->'M3'->>'winnerId'), (bkp.matches->'M4'->>'winnerId'),
      (bkp.matches->'M5'->>'winnerId'), (bkp.matches->'M6'->>'winnerId'),
      (bkp.matches->'M7'->>'winnerId'), (bkp.matches->'M8'->>'winnerId'),
      (bkp.matches->'M9'->>'winnerId'), (bkp.matches->'M10'->>'winnerId'),
      (bkp.matches->'M11'->>'winnerId'), (bkp.matches->'M12'->>'winnerId'),
      (bkp.matches->'M13'->>'winnerId'), (bkp.matches->'M14'->>'winnerId'),
      (bkp.matches->'M15'->>'winnerId'), (bkp.matches->'M16'->>'winnerId')
    ) as m(winner_id)
    where m.winner_id is not null and m.winner_id <> ''
    union
    select ub.bracket_id, 'QF', m.winner_id
    from ub
    join public.bracket_knockout_picks bkp on bkp.bracket_id = ub.bracket_id
    cross join lateral (values
      (bkp.matches->'R16_1'->>'winnerId'), (bkp.matches->'R16_2'->>'winnerId'),
      (bkp.matches->'R16_3'->>'winnerId'), (bkp.matches->'R16_4'->>'winnerId'),
      (bkp.matches->'R16_5'->>'winnerId'), (bkp.matches->'R16_6'->>'winnerId'),
      (bkp.matches->'R16_7'->>'winnerId'), (bkp.matches->'R16_8'->>'winnerId')
    ) as m(winner_id)
    where m.winner_id is not null and m.winner_id <> ''
    union
    select ub.bracket_id, 'SF', m.winner_id
    from ub
    join public.bracket_knockout_picks bkp on bkp.bracket_id = ub.bracket_id
    cross join lateral (values
      (bkp.matches->'QF1'->>'winnerId'), (bkp.matches->'QF2'->>'winnerId'),
      (bkp.matches->'QF3'->>'winnerId'), (bkp.matches->'QF4'->>'winnerId')
    ) as m(winner_id)
    where m.winner_id is not null and m.winner_id <> ''
    union
    select ub.bracket_id, 'FINAL', m.winner_id
    from ub
    join public.bracket_knockout_picks bkp on bkp.bracket_id = ub.bracket_id
    cross join lateral (values
      (bkp.matches->'SF1'->>'winnerId'), (bkp.matches->'SF2'->>'winnerId')
    ) as m(winner_id)
    where m.winner_id is not null and m.winner_id <> ''
    union
    select ub.bracket_id, 'CHAMPION', bkp.matches->'FINAL'->>'winnerId'
    from ub
    join public.bracket_knockout_picks bkp on bkp.bracket_id = ub.bracket_id
    where bkp.matches->'FINAL'->>'winnerId' is not null
      and bkp.matches->'FINAL'->>'winnerId' <> ''
  ),
  points_per_bracket as (
    select
      prt.bracket_id,
      coalesce(sum(
        case prt.round_key
          when 'R32' then 1
          when 'R16' then 2
          when 'QF' then 4
          when 'SF' then 6
          when 'FINAL' then 8
          when 'CHAMPION' then 12
          else 0
        end
      ), 0)::integer as total_points,
      coalesce(sum(case when prt.round_key = 'R32' then 1 else 0 end), 0)::integer as r32_points
    from predicted_round_teams prt
    join actual_round_teams art
      on art.round_key = prt.round_key
      and art.team_id = prt.team_id
    group by prt.bracket_id
  ),
  scored as (
    select
      ub.user_id,
      ub.bracket_id,
      ub.bracket_name,
      bkp.total_goals as predicted_total_goals,
      bkp.top_scorer as predicted_top_scorer,
      coalesce(ppb.r32_points, 0) as group_points,
      (coalesce(ppb.total_points, 0) - coalesce(ppb.r32_points, 0))::integer as knockout_points,
      coalesce(ppb.total_points, 0)::integer as total_points,
      case
        when v_actual_total_goals is null or bkp.total_goals is null then null
        else abs(bkp.total_goals - v_actual_total_goals)
      end as total_goals_delta
    from ub
    join public.bracket_knockout_picks bkp on bkp.bracket_id = ub.bracket_id
    left join points_per_bracket ppb on ppb.bracket_id = ub.bracket_id
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
    rank() over (order by s.total_points desc, s.total_goals_delta asc nulls last)::integer,
    (select pub.published_at
     from public.tournament_standings_publication pub
     where pub.edition_id = v_edition_id)
  from scored s
  left join public.profiles p on p.id = s.user_id
  order by s.total_points desc, s.total_goals_delta asc nulls last, p.display_name nulls last, p.email nulls last;
end;
$$;

grant execute on function public.get_tournament_leaderboard(uuid) to authenticated;
