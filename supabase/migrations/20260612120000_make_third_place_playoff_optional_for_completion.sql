-- The third-place playoff is not part of leaderboard scoring, so do not let a
-- missing 3PO winner exclude an otherwise complete bracket from the leaderboard.

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
      and jsonb_typeof(bkp.matches) = 'object'
      and (
        select count(*)
        from jsonb_each(bkp.matches) as m(match_id, match_json)
        where m.match_id <> '3PO'
          and m.match_json->>'winnerId' is not null
          and m.match_json->>'winnerId' <> ''
      ) >= 31
  );
$$;

grant execute on function public.bracket_is_complete(uuid) to authenticated;
