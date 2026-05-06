-- Include per-selection scoring details in the leaderboard bracket viewer.

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

  if v_is_locked is null or v_edition_id is null then
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
  bracket_row as (
    select
      b.id,
      b.tournament_id,
      b.user_id,
      b.name,
      b.current_step,
      b.furthest_step,
      bkp.selected_third_place,
      bkp.third_place_assignment,
      bkp.matches,
      bkp.total_goals,
      bkp.top_scorer
    from public.brackets b
    join public.bracket_knockout_picks bkp on bkp.bracket_id = b.id
    where b.tournament_id = p_tournament_id
      and b.id = p_bracket_id
      and public.bracket_is_complete(b.id)
  ),
  r32_selections as (
    select
      s.match_id,
      s.slot_key,
      'slot'::text as selection_type,
      'R32'::text as round_key,
      'Round of 32'::text as label,
      s.team_id,
      1::integer as points
    from bracket_row br
    cross join lateral (values
      ('M1', 'slot1', br.matches->'M1'->'slot1'->>'teamId'), ('M1', 'slot2', br.matches->'M1'->'slot2'->>'teamId'),
      ('M2', 'slot1', br.matches->'M2'->'slot1'->>'teamId'), ('M2', 'slot2', br.matches->'M2'->'slot2'->>'teamId'),
      ('M3', 'slot1', br.matches->'M3'->'slot1'->>'teamId'), ('M3', 'slot2', br.matches->'M3'->'slot2'->>'teamId'),
      ('M4', 'slot1', br.matches->'M4'->'slot1'->>'teamId'), ('M4', 'slot2', br.matches->'M4'->'slot2'->>'teamId'),
      ('M5', 'slot1', br.matches->'M5'->'slot1'->>'teamId'), ('M5', 'slot2', br.matches->'M5'->'slot2'->>'teamId'),
      ('M6', 'slot1', br.matches->'M6'->'slot1'->>'teamId'), ('M6', 'slot2', br.matches->'M6'->'slot2'->>'teamId'),
      ('M7', 'slot1', br.matches->'M7'->'slot1'->>'teamId'), ('M7', 'slot2', br.matches->'M7'->'slot2'->>'teamId'),
      ('M8', 'slot1', br.matches->'M8'->'slot1'->>'teamId'), ('M8', 'slot2', br.matches->'M8'->'slot2'->>'teamId'),
      ('M9', 'slot1', br.matches->'M9'->'slot1'->>'teamId'), ('M9', 'slot2', br.matches->'M9'->'slot2'->>'teamId'),
      ('M10', 'slot1', br.matches->'M10'->'slot1'->>'teamId'), ('M10', 'slot2', br.matches->'M10'->'slot2'->>'teamId'),
      ('M11', 'slot1', br.matches->'M11'->'slot1'->>'teamId'), ('M11', 'slot2', br.matches->'M11'->'slot2'->>'teamId'),
      ('M12', 'slot1', br.matches->'M12'->'slot1'->>'teamId'), ('M12', 'slot2', br.matches->'M12'->'slot2'->>'teamId'),
      ('M13', 'slot1', br.matches->'M13'->'slot1'->>'teamId'), ('M13', 'slot2', br.matches->'M13'->'slot2'->>'teamId'),
      ('M14', 'slot1', br.matches->'M14'->'slot1'->>'teamId'), ('M14', 'slot2', br.matches->'M14'->'slot2'->>'teamId'),
      ('M15', 'slot1', br.matches->'M15'->'slot1'->>'teamId'), ('M15', 'slot2', br.matches->'M15'->'slot2'->>'teamId'),
      ('M16', 'slot1', br.matches->'M16'->'slot1'->>'teamId'), ('M16', 'slot2', br.matches->'M16'->'slot2'->>'teamId')
    ) as s(match_id, slot_key, team_id)
    where s.team_id is not null and s.team_id <> ''
  ),
  winner_selections as (
    select
      s.match_id,
      case
        when br.matches->s.match_id->'slot1'->>'teamId' = s.team_id then 'slot1'
        when br.matches->s.match_id->'slot2'->>'teamId' = s.team_id then 'slot2'
        else 'winner'
      end as slot_key,
      'winner'::text as selection_type,
      s.round_key,
      s.label,
      s.team_id,
      s.points
    from bracket_row br
    cross join lateral (values
      ('M1', 'R16', 'Round of 16', 2, br.matches->'M1'->>'winnerId'),
      ('M2', 'R16', 'Round of 16', 2, br.matches->'M2'->>'winnerId'),
      ('M3', 'R16', 'Round of 16', 2, br.matches->'M3'->>'winnerId'),
      ('M4', 'R16', 'Round of 16', 2, br.matches->'M4'->>'winnerId'),
      ('M5', 'R16', 'Round of 16', 2, br.matches->'M5'->>'winnerId'),
      ('M6', 'R16', 'Round of 16', 2, br.matches->'M6'->>'winnerId'),
      ('M7', 'R16', 'Round of 16', 2, br.matches->'M7'->>'winnerId'),
      ('M8', 'R16', 'Round of 16', 2, br.matches->'M8'->>'winnerId'),
      ('M9', 'R16', 'Round of 16', 2, br.matches->'M9'->>'winnerId'),
      ('M10', 'R16', 'Round of 16', 2, br.matches->'M10'->>'winnerId'),
      ('M11', 'R16', 'Round of 16', 2, br.matches->'M11'->>'winnerId'),
      ('M12', 'R16', 'Round of 16', 2, br.matches->'M12'->>'winnerId'),
      ('M13', 'R16', 'Round of 16', 2, br.matches->'M13'->>'winnerId'),
      ('M14', 'R16', 'Round of 16', 2, br.matches->'M14'->>'winnerId'),
      ('M15', 'R16', 'Round of 16', 2, br.matches->'M15'->>'winnerId'),
      ('M16', 'R16', 'Round of 16', 2, br.matches->'M16'->>'winnerId'),
      ('R16_1', 'QF', 'Quarterfinals', 4, br.matches->'R16_1'->>'winnerId'),
      ('R16_2', 'QF', 'Quarterfinals', 4, br.matches->'R16_2'->>'winnerId'),
      ('R16_3', 'QF', 'Quarterfinals', 4, br.matches->'R16_3'->>'winnerId'),
      ('R16_4', 'QF', 'Quarterfinals', 4, br.matches->'R16_4'->>'winnerId'),
      ('R16_5', 'QF', 'Quarterfinals', 4, br.matches->'R16_5'->>'winnerId'),
      ('R16_6', 'QF', 'Quarterfinals', 4, br.matches->'R16_6'->>'winnerId'),
      ('R16_7', 'QF', 'Quarterfinals', 4, br.matches->'R16_7'->>'winnerId'),
      ('R16_8', 'QF', 'Quarterfinals', 4, br.matches->'R16_8'->>'winnerId'),
      ('QF1', 'SF', 'Semifinals', 6, br.matches->'QF1'->>'winnerId'),
      ('QF2', 'SF', 'Semifinals', 6, br.matches->'QF2'->>'winnerId'),
      ('QF3', 'SF', 'Semifinals', 6, br.matches->'QF3'->>'winnerId'),
      ('QF4', 'SF', 'Semifinals', 6, br.matches->'QF4'->>'winnerId'),
      ('SF1', 'FINAL', 'Final', 8, br.matches->'SF1'->>'winnerId'),
      ('SF2', 'FINAL', 'Final', 8, br.matches->'SF2'->>'winnerId'),
      ('FINAL', 'CHAMPION', 'Champion', 12, br.matches->'FINAL'->>'winnerId')
    ) as s(match_id, round_key, label, points, team_id)
    where s.team_id is not null and s.team_id <> ''
  ),
  selections as (
    select * from r32_selections
    union all
    select * from winner_selections
  ),
  scored_selections as (
    select
      s.match_id,
      s.slot_key,
      s.selection_type,
      s.round_key,
      s.label,
      s.team_id,
      s.points,
      (art.team_id is not null) as awarded
    from selections s
    left join actual_round_teams art
      on art.round_key = s.round_key
      and art.team_id = s.team_id
  )
  select
    br.id as bracket_id,
    br.tournament_id,
    br.user_id,
    br.name as bracket_name,
    br.current_step,
    br.furthest_step,
    coalesce(
      (select jsonb_object_agg(bgr.group_id, bgr.rankings)
       from public.bracket_group_rankings bgr
       where bgr.bracket_id = br.id),
      '{}'::jsonb
    ) as rankings,
    jsonb_build_object(
      'selected_third_place', coalesce(br.selected_third_place, '[]'::jsonb),
      'third_place_assignment', coalesce(br.third_place_assignment, '{}'::jsonb),
      'matches', coalesce(br.matches, '{}'::jsonb),
      'total_goals', br.total_goals,
      'top_scorer', coalesce(br.top_scorer, ''),
      'scoring_breakdown', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'match_id', ss.match_id,
              'slot', ss.slot_key,
              'selection_type', ss.selection_type,
              'round_key', ss.round_key,
              'label', ss.label,
              'team_id', ss.team_id,
              'points', ss.points,
              'awarded', ss.awarded
            )
            order by
              case ss.round_key
                when 'R32' then 1
                when 'R16' then 2
                when 'QF' then 3
                when 'SF' then 4
                when 'FINAL' then 5
                when 'CHAMPION' then 6
                else 7
              end,
              ss.match_id,
              ss.slot_key
          )
          from scored_selections ss
        ),
        '[]'::jsonb
      )
    ) as knockout
  from bracket_row br;
end;
$$;

grant execute on function public.get_tournament_leaderboard_bracket(uuid, uuid) to authenticated;
