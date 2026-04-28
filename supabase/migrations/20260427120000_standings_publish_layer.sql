-- Standings publish layer: split admin "draft" edits (the existing
-- tournament_group_results / tournament_match_results tables) from user-facing
-- "published" snapshots. Adds a per-tournament publication metadata row used
-- to render the leaderboard's "Published as of" label.

create table if not exists public.tournament_group_results_published (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_id      text not null,
  rankings      jsonb not null,
  published_at  timestamptz not null default now(),
  published_by  uuid references auth.users(id),
  primary key (tournament_id, group_id)
);

create table if not exists public.tournament_match_results_published (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id      text not null,
  winner_id     text,
  published_at  timestamptz not null default now(),
  published_by  uuid references auth.users(id),
  primary key (tournament_id, match_id)
);

create table if not exists public.tournament_standings_publication (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  published_at  timestamptz not null default now(),
  published_by  uuid references auth.users(id)
);

alter table public.tournament_group_results_published enable row level security;
alter table public.tournament_match_results_published enable row level security;
alter table public.tournament_standings_publication enable row level security;

drop policy if exists tournament_group_results_pub_select on public.tournament_group_results_published;
create policy tournament_group_results_pub_select on public.tournament_group_results_published
for select to authenticated
using (public.user_can_access_tournament(tournament_id, auth.uid()));

drop policy if exists tournament_group_results_pub_admin_write on public.tournament_group_results_published;
create policy tournament_group_results_pub_admin_write on public.tournament_group_results_published
for all to authenticated
using (public.is_global_admin(auth.uid()))
with check (public.is_global_admin(auth.uid()));

drop policy if exists tournament_match_results_pub_select on public.tournament_match_results_published;
create policy tournament_match_results_pub_select on public.tournament_match_results_published
for select to authenticated
using (public.user_can_access_tournament(tournament_id, auth.uid()));

drop policy if exists tournament_match_results_pub_admin_write on public.tournament_match_results_published;
create policy tournament_match_results_pub_admin_write on public.tournament_match_results_published
for all to authenticated
using (public.is_global_admin(auth.uid()))
with check (public.is_global_admin(auth.uid()));

drop policy if exists tournament_standings_publication_select on public.tournament_standings_publication;
create policy tournament_standings_publication_select on public.tournament_standings_publication
for select to authenticated
using (public.user_can_access_tournament(tournament_id, auth.uid()));

drop policy if exists tournament_standings_publication_admin_write on public.tournament_standings_publication;
create policy tournament_standings_publication_admin_write on public.tournament_standings_publication
for all to authenticated
using (public.is_global_admin(auth.uid()))
with check (public.is_global_admin(auth.uid()));

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
      (select jsonb_object_agg(group_id, rankings)
       from public.tournament_group_results
       where tournament_id = p_tournament_id),
      '{}'::jsonb
    ),
    coalesce(
      (select jsonb_object_agg(match_id, winner_id)
       from public.tournament_match_results
       where tournament_id = p_tournament_id),
      '{}'::jsonb
    ),
    coalesce(
      (select jsonb_object_agg(group_id, rankings)
       from public.tournament_group_results_published
       where tournament_id = p_tournament_id),
      '{}'::jsonb
    ),
    coalesce(
      (select jsonb_object_agg(match_id, winner_id)
       from public.tournament_match_results_published
       where tournament_id = p_tournament_id),
      '{}'::jsonb
    ),
    (select published_at
     from public.tournament_standings_publication
     where tournament_id = p_tournament_id),
    (select greatest(
       coalesce((select max(updated_at) from public.tournament_group_results
                 where tournament_id = p_tournament_id), 'epoch'::timestamptz),
       coalesce((select max(updated_at) from public.tournament_match_results
                 where tournament_id = p_tournament_id), 'epoch'::timestamptz)
     ));
end;
$$;

grant execute on function public.admin_get_standings_editor(uuid) to authenticated;

create or replace function public.admin_publish_standings_update(p_tournament_id uuid)
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
  where tournament_id = p_tournament_id;

  insert into public.tournament_group_results_published
    (tournament_id, group_id, rankings, published_at, published_by)
  select tournament_id, group_id, rankings, v_now, auth.uid()
  from public.tournament_group_results
  where tournament_id = p_tournament_id;

  delete from public.tournament_match_results_published
  where tournament_id = p_tournament_id;

  insert into public.tournament_match_results_published
    (tournament_id, match_id, winner_id, published_at, published_by)
  select tournament_id, match_id, winner_id, v_now, auth.uid()
  from public.tournament_match_results
  where tournament_id = p_tournament_id;

  insert into public.tournament_standings_publication
    (tournament_id, published_at, published_by)
  values (p_tournament_id, v_now, auth.uid())
  on conflict (tournament_id)
  do update set published_at = excluded.published_at,
                published_by = excluded.published_by;

  return v_now;
end;
$$;

grant execute on function public.admin_publish_standings_update(uuid) to authenticated;

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
      (select jsonb_object_agg(group_id, rankings)
       from public.tournament_group_results_published
       where tournament_id = p_tournament_id),
      '{}'::jsonb
    ),
    coalesce(
      (select jsonb_object_agg(match_id, winner_id)
       from public.tournament_match_results_published
       where tournament_id = p_tournament_id),
      '{}'::jsonb
    ),
    (select published_at
     from public.tournament_standings_publication
     where tournament_id = p_tournament_id);
end;
$$;

grant execute on function public.get_tournament_published_standings(uuid) to authenticated;

-- Provisional scoring: 5 points per exact group-position match, 10 points per
-- correct knockout winner. Final point weights are deliberately TBD per the
-- standings plan; swapping these scalars is the only change needed when
-- scoring rules are finalized.
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
    select group_id, rankings
    from public.tournament_group_results_published
    where tournament_id = p_tournament_id
  ),
  pm as (
    select match_id, winner_id
    from public.tournament_match_results_published
    where tournament_id = p_tournament_id
      and winner_id is not null
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
      coalesce(gp.group_points, 0) as group_points,
      coalesce(kp.knockout_points, 0) as knockout_points,
      (coalesce(gp.group_points, 0) + coalesce(kp.knockout_points, 0)) as total_points
    from ub
    left join group_points_per_bracket gp on gp.bracket_id = ub.bracket_id
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
    rank() over (order by s.total_points desc)::integer as rank_position,
    (select published_at
     from public.tournament_standings_publication
     where tournament_id = p_tournament_id) as published_at
  from scored s
  left join public.profiles p on p.id = s.user_id
  order by s.total_points desc, p.display_name nulls last, p.email nulls last;
end;
$$;

grant execute on function public.get_tournament_leaderboard(uuid) to authenticated;
