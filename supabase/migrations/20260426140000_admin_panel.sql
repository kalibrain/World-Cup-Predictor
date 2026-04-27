-- Admin panel: actuals tables (separate from per-bracket predictions) and
-- global-admin RPCs for tournament oversight.

create table if not exists public.tournament_group_results (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_id      text not null,
  rankings      jsonb not null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id),
  primary key (tournament_id, group_id)
);

create table if not exists public.tournament_match_results (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id      text not null,
  winner_id     text,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id),
  primary key (tournament_id, match_id)
);

create table if not exists public.tournament_tiebreakers (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  total_goals   integer,
  top_scorer    text not null default '',
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id)
);

drop trigger if exists trg_tournament_group_results_updated_at on public.tournament_group_results;
create trigger trg_tournament_group_results_updated_at
before update on public.tournament_group_results
for each row execute function public.touch_updated_at();

drop trigger if exists trg_tournament_match_results_updated_at on public.tournament_match_results;
create trigger trg_tournament_match_results_updated_at
before update on public.tournament_match_results
for each row execute function public.touch_updated_at();

drop trigger if exists trg_tournament_tiebreakers_updated_at on public.tournament_tiebreakers;
create trigger trg_tournament_tiebreakers_updated_at
before update on public.tournament_tiebreakers
for each row execute function public.touch_updated_at();

alter table public.tournament_group_results enable row level security;
alter table public.tournament_match_results enable row level security;
alter table public.tournament_tiebreakers enable row level security;

drop policy if exists tournament_group_results_select on public.tournament_group_results;
create policy tournament_group_results_select on public.tournament_group_results
for select to authenticated
using (public.user_can_access_tournament(tournament_id, auth.uid()));

drop policy if exists tournament_group_results_admin_write on public.tournament_group_results;
create policy tournament_group_results_admin_write on public.tournament_group_results
for all to authenticated
using (public.is_global_admin(auth.uid()))
with check (public.is_global_admin(auth.uid()));

drop policy if exists tournament_match_results_select on public.tournament_match_results;
create policy tournament_match_results_select on public.tournament_match_results
for select to authenticated
using (public.user_can_access_tournament(tournament_id, auth.uid()));

drop policy if exists tournament_match_results_admin_write on public.tournament_match_results;
create policy tournament_match_results_admin_write on public.tournament_match_results
for all to authenticated
using (public.is_global_admin(auth.uid()))
with check (public.is_global_admin(auth.uid()));

drop policy if exists tournament_tiebreakers_select on public.tournament_tiebreakers;
create policy tournament_tiebreakers_select on public.tournament_tiebreakers
for select to authenticated
using (public.user_can_access_tournament(tournament_id, auth.uid()));

drop policy if exists tournament_tiebreakers_admin_write on public.tournament_tiebreakers;
create policy tournament_tiebreakers_admin_write on public.tournament_tiebreakers
for all to authenticated
using (public.is_global_admin(auth.uid()))
with check (public.is_global_admin(auth.uid()));

create or replace function public.current_user_is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_global_admin(auth.uid());
$$;

grant execute on function public.current_user_is_global_admin() to authenticated;

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
  select
    t.id,
    t.name,
    t.visibility,
    t.status,
    t.starts_at,
    t.locks_at,
    now() >= t.locks_at as is_locked,
    coalesce(m.cnt, 0) as member_count,
    coalesce(b.cnt, 0) as bracket_count,
    coalesce(gr.cnt, 0) as results_groups_entered,
    coalesce(mr.cnt, 0) as results_matches_entered,
    (tb.tournament_id is not null) as tiebreakers_entered,
    t.created_at
  from public.tournaments t
  left join (
    select tournament_id, count(*) as cnt
    from public.tournament_memberships
    group by tournament_id
  ) m on m.tournament_id = t.id
  left join (
    select tournament_id, count(*) as cnt
    from public.brackets
    group by tournament_id
  ) b on b.tournament_id = t.id
  left join (
    select tournament_id, count(*) as cnt
    from public.tournament_group_results
    group by tournament_id
  ) gr on gr.tournament_id = t.id
  left join (
    select tournament_id, count(*) as cnt
    from public.tournament_match_results
    where winner_id is not null
    group by tournament_id
  ) mr on mr.tournament_id = t.id
  left join public.tournament_tiebreakers tb on tb.tournament_id = t.id
  order by t.created_at desc;
end;
$$;

grant execute on function public.admin_list_tournaments_overview() to authenticated;

create or replace function public.admin_list_tournament_members(p_tournament_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.membership_role,
  joined_at timestamptz,
  bracket_id uuid,
  bracket_name text,
  bracket_updated_at timestamptz,
  bracket_furthest_step text
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
    tm.user_id,
    p.email,
    p.display_name,
    tm.role,
    tm.joined_at,
    b.id as bracket_id,
    b.name as bracket_name,
    b.updated_at as bracket_updated_at,
    b.furthest_step as bracket_furthest_step
  from public.tournament_memberships tm
  left join public.profiles p on p.id = tm.user_id
  left join public.brackets b
    on b.tournament_id = tm.tournament_id
    and b.user_id = tm.user_id
  where tm.tournament_id = p_tournament_id
  order by p.display_name nulls last, p.email nulls last;
end;
$$;

grant execute on function public.admin_list_tournament_members(uuid) to authenticated;

create or replace function public.admin_revoke_membership(p_tournament_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_global_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  delete from public.tournament_memberships
  where tournament_id = p_tournament_id
    and user_id = p_user_id;
end;
$$;

grant execute on function public.admin_revoke_membership(uuid, uuid) to authenticated;

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

  delete from public.brackets where id = p_bracket_id;
end;
$$;

grant execute on function public.admin_delete_bracket(uuid) to authenticated;

create or replace function public.admin_upsert_group_result(
  p_tournament_id uuid,
  p_group_id text,
  p_rankings jsonb
)
returns public.tournament_group_results
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.tournament_group_results;
begin
  if not public.is_global_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  insert into public.tournament_group_results (tournament_id, group_id, rankings, updated_by)
  values (p_tournament_id, p_group_id, p_rankings, auth.uid())
  on conflict (tournament_id, group_id)
  do update set rankings = excluded.rankings, updated_by = excluded.updated_by, updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_upsert_group_result(uuid, text, jsonb) to authenticated;

create or replace function public.admin_upsert_match_result(
  p_tournament_id uuid,
  p_match_id text,
  p_winner_id text
)
returns public.tournament_match_results
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.tournament_match_results;
begin
  if not public.is_global_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  insert into public.tournament_match_results (tournament_id, match_id, winner_id, updated_by)
  values (p_tournament_id, p_match_id, p_winner_id, auth.uid())
  on conflict (tournament_id, match_id)
  do update set winner_id = excluded.winner_id, updated_by = excluded.updated_by, updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_upsert_match_result(uuid, text, text) to authenticated;

create or replace function public.admin_upsert_tiebreakers(
  p_tournament_id uuid,
  p_total_goals integer,
  p_top_scorer text
)
returns public.tournament_tiebreakers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.tournament_tiebreakers;
begin
  if not public.is_global_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  insert into public.tournament_tiebreakers (tournament_id, total_goals, top_scorer, updated_by)
  values (p_tournament_id, p_total_goals, coalesce(p_top_scorer, ''), auth.uid())
  on conflict (tournament_id)
  do update set
    total_goals = excluded.total_goals,
    top_scorer = excluded.top_scorer,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_upsert_tiebreakers(uuid, integer, text) to authenticated;

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
      (select jsonb_object_agg(group_id, rankings)
       from public.tournament_group_results
       where tournament_id = p_tournament_id),
      '{}'::jsonb
    ) as group_results,
    coalesce(
      (select jsonb_object_agg(match_id, winner_id)
       from public.tournament_match_results
       where tournament_id = p_tournament_id),
      '{}'::jsonb
    ) as match_results,
    coalesce(
      (select to_jsonb(tb) - 'tournament_id'
       from public.tournament_tiebreakers tb
       where tournament_id = p_tournament_id),
      'null'::jsonb
    ) as tiebreakers;
end;
$$;

grant execute on function public.admin_get_tournament_results(uuid) to authenticated;

create or replace function public.admin_upsert_tournament(
  p_id uuid,
  p_name text,
  p_visibility public.tournament_visibility,
  p_status public.tournament_status,
  p_starts_at timestamptz,
  p_locks_at timestamptz
)
returns public.tournaments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.tournaments;
begin
  if not public.is_global_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if p_id is null then
    insert into public.tournaments (name, visibility, status, starts_at, locks_at, created_by)
    values (p_name, p_visibility, p_status, p_starts_at, p_locks_at, auth.uid())
    returning * into v_row;
  else
    update public.tournaments
    set name = p_name,
        visibility = p_visibility,
        status = p_status,
        starts_at = p_starts_at,
        locks_at = p_locks_at
    where id = p_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function public.admin_upsert_tournament(uuid, text, public.tournament_visibility, public.tournament_status, timestamptz, timestamptz) to authenticated;

create or replace function public.admin_archive_tournament(p_tournament_id uuid)
returns public.tournaments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.tournaments;
begin
  if not public.is_global_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  update public.tournaments
  set status = 'archived'
  where id = p_tournament_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_archive_tournament(uuid) to authenticated;

-- Admin reading another user's bracket: extend the existing fetch by exposing
-- a SECURITY DEFINER helper so RLS doesn't matter here; the function gates on
-- is_global_admin(auth.uid()).
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
    b.id as bracket_id,
    b.tournament_id,
    b.user_id,
    b.name as bracket_name,
    b.current_step,
    b.furthest_step,
    coalesce(
      (select jsonb_object_agg(group_id, rankings)
       from public.bracket_group_rankings
       where bracket_id = b.id),
      '{}'::jsonb
    ) as rankings,
    coalesce(
      (select to_jsonb(k) - 'bracket_id' - 'id' - 'updated_at'
       from public.bracket_knockout_picks k
       where k.bracket_id = b.id),
      '{}'::jsonb
    ) as knockout
  from public.brackets b
  where b.id = p_bracket_id;
end;
$$;

grant execute on function public.admin_get_bracket(uuid) to authenticated;
