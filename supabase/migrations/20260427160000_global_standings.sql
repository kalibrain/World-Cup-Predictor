-- Promote standings to a real-world "edition" so multiple pool tournaments
-- can share the same actual outcomes. Existing tournaments are migrated
-- onto a single default edition; standings tables get re-keyed by
-- edition_id; admin standings RPCs now operate on editions.

create table if not exists public.tournament_editions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.tournament_editions enable row level security;

drop policy if exists tournament_editions_select on public.tournament_editions;
create policy tournament_editions_select on public.tournament_editions
  for select to authenticated using (true);

drop policy if exists tournament_editions_admin_write on public.tournament_editions;
create policy tournament_editions_admin_write on public.tournament_editions
  for all to authenticated
  using (public.is_global_admin(auth.uid()))
  with check (public.is_global_admin(auth.uid()));

grant select on public.tournament_editions to authenticated;
grant insert, update, delete on public.tournament_editions to authenticated;

insert into public.tournament_editions (id, name)
values ('00000000-0000-0000-0000-000000000001'::uuid, 'FIFA World Cup 2026')
on conflict (id) do nothing;

alter table public.tournaments
  add column if not exists edition_id uuid references public.tournament_editions(id);

update public.tournaments
  set edition_id = '00000000-0000-0000-0000-000000000001'::uuid
  where edition_id is null;

alter table public.tournaments
  alter column edition_id set not null;

-- Drop the existing SELECT policies *before* re-keying the tables: each
-- policy references the soon-to-be-removed tournament_id column and would
-- block the ALTER TABLE ... DROP COLUMN otherwise. New SELECT policies are
-- recreated after the rekey.
drop policy if exists tournament_group_results_select on public.tournament_group_results;
drop policy if exists tournament_match_results_select on public.tournament_match_results;
drop policy if exists tournament_tiebreakers_select on public.tournament_tiebreakers;
drop policy if exists tournament_group_results_pub_select on public.tournament_group_results_published;
drop policy if exists tournament_match_results_pub_select on public.tournament_match_results_published;
drop policy if exists tournament_standings_publication_select on public.tournament_standings_publication;

-- Helper: rekey a per-tournament standings table to per-edition. Inlined per
-- table because the dedup uniqueness key differs (group_id / match_id / none).

-- tournament_group_results
alter table public.tournament_group_results
  add column if not exists edition_id uuid references public.tournament_editions(id);

update public.tournament_group_results gr
  set edition_id = t.edition_id
  from public.tournaments t
  where gr.tournament_id = t.id
    and gr.edition_id is null;

delete from public.tournament_group_results
  where ctid in (
    select ctid from (
      select ctid, row_number() over (
        partition by edition_id, group_id
        order by updated_at desc, ctid desc
      ) as rn
      from public.tournament_group_results
    ) s
    where s.rn > 1
  );

alter table public.tournament_group_results
  alter column edition_id set not null;

alter table public.tournament_group_results
  drop constraint if exists tournament_group_results_pkey;

alter table public.tournament_group_results
  add primary key (edition_id, group_id);

drop policy if exists tournament_group_results_select on public.tournament_group_results;

alter table public.tournament_group_results
  drop column if exists tournament_id;

-- tournament_match_results
alter table public.tournament_match_results
  add column if not exists edition_id uuid references public.tournament_editions(id);

update public.tournament_match_results mr
  set edition_id = t.edition_id
  from public.tournaments t
  where mr.tournament_id = t.id
    and mr.edition_id is null;

delete from public.tournament_match_results
  where ctid in (
    select ctid from (
      select ctid, row_number() over (
        partition by edition_id, match_id
        order by updated_at desc, ctid desc
      ) as rn
      from public.tournament_match_results
    ) s
    where s.rn > 1
  );

alter table public.tournament_match_results
  alter column edition_id set not null;

alter table public.tournament_match_results
  drop constraint if exists tournament_match_results_pkey;

alter table public.tournament_match_results
  add primary key (edition_id, match_id);

drop policy if exists tournament_match_results_select on public.tournament_match_results;

alter table public.tournament_match_results
  drop column if exists tournament_id;

-- tournament_tiebreakers
alter table public.tournament_tiebreakers
  add column if not exists edition_id uuid references public.tournament_editions(id);

update public.tournament_tiebreakers tb
  set edition_id = t.edition_id
  from public.tournaments t
  where tb.tournament_id = t.id
    and tb.edition_id is null;

delete from public.tournament_tiebreakers
  where ctid in (
    select ctid from (
      select ctid, row_number() over (
        partition by edition_id
        order by updated_at desc, ctid desc
      ) as rn
      from public.tournament_tiebreakers
    ) s
    where s.rn > 1
  );

alter table public.tournament_tiebreakers
  alter column edition_id set not null;

alter table public.tournament_tiebreakers
  drop constraint if exists tournament_tiebreakers_pkey;

alter table public.tournament_tiebreakers
  add primary key (edition_id);

drop policy if exists tournament_tiebreakers_select on public.tournament_tiebreakers;

alter table public.tournament_tiebreakers
  drop column if exists tournament_id;

-- tournament_group_results_published
alter table public.tournament_group_results_published
  add column if not exists edition_id uuid references public.tournament_editions(id);

update public.tournament_group_results_published grp
  set edition_id = t.edition_id
  from public.tournaments t
  where grp.tournament_id = t.id
    and grp.edition_id is null;

delete from public.tournament_group_results_published
  where ctid in (
    select ctid from (
      select ctid, row_number() over (
        partition by edition_id, group_id
        order by published_at desc, ctid desc
      ) as rn
      from public.tournament_group_results_published
    ) s
    where s.rn > 1
  );

alter table public.tournament_group_results_published
  alter column edition_id set not null;

alter table public.tournament_group_results_published
  drop constraint if exists tournament_group_results_published_pkey;

alter table public.tournament_group_results_published
  add primary key (edition_id, group_id);

drop policy if exists tournament_group_results_pub_select on public.tournament_group_results_published;

alter table public.tournament_group_results_published
  drop column if exists tournament_id;

-- tournament_match_results_published
alter table public.tournament_match_results_published
  add column if not exists edition_id uuid references public.tournament_editions(id);

update public.tournament_match_results_published mrp
  set edition_id = t.edition_id
  from public.tournaments t
  where mrp.tournament_id = t.id
    and mrp.edition_id is null;

delete from public.tournament_match_results_published
  where ctid in (
    select ctid from (
      select ctid, row_number() over (
        partition by edition_id, match_id
        order by published_at desc, ctid desc
      ) as rn
      from public.tournament_match_results_published
    ) s
    where s.rn > 1
  );

alter table public.tournament_match_results_published
  alter column edition_id set not null;

alter table public.tournament_match_results_published
  drop constraint if exists tournament_match_results_published_pkey;

alter table public.tournament_match_results_published
  add primary key (edition_id, match_id);

drop policy if exists tournament_match_results_pub_select on public.tournament_match_results_published;

alter table public.tournament_match_results_published
  drop column if exists tournament_id;

-- tournament_standings_publication
alter table public.tournament_standings_publication
  add column if not exists edition_id uuid references public.tournament_editions(id);

update public.tournament_standings_publication tsp
  set edition_id = t.edition_id
  from public.tournaments t
  where tsp.tournament_id = t.id
    and tsp.edition_id is null;

delete from public.tournament_standings_publication
  where ctid in (
    select ctid from (
      select ctid, row_number() over (
        partition by edition_id
        order by published_at desc, ctid desc
      ) as rn
      from public.tournament_standings_publication
    ) s
    where s.rn > 1
  );

alter table public.tournament_standings_publication
  alter column edition_id set not null;

alter table public.tournament_standings_publication
  drop constraint if exists tournament_standings_publication_pkey;

alter table public.tournament_standings_publication
  add primary key (edition_id);

drop policy if exists tournament_standings_publication_select on public.tournament_standings_publication;

alter table public.tournament_standings_publication
  drop column if exists tournament_id;

-- Replace SELECT policies (the old policies referenced tournament_id which
-- no longer exists). Real-world standings are global facts; any signed-in
-- user can read them.
drop policy if exists tournament_group_results_select on public.tournament_group_results;
create policy tournament_group_results_select on public.tournament_group_results
  for select to authenticated using (true);

drop policy if exists tournament_match_results_select on public.tournament_match_results;
create policy tournament_match_results_select on public.tournament_match_results
  for select to authenticated using (true);

drop policy if exists tournament_tiebreakers_select on public.tournament_tiebreakers;
create policy tournament_tiebreakers_select on public.tournament_tiebreakers
  for select to authenticated using (true);

drop policy if exists tournament_group_results_pub_select on public.tournament_group_results_published;
create policy tournament_group_results_pub_select on public.tournament_group_results_published
  for select to authenticated using (true);

drop policy if exists tournament_match_results_pub_select on public.tournament_match_results_published;
create policy tournament_match_results_pub_select on public.tournament_match_results_published
  for select to authenticated using (true);

drop policy if exists tournament_standings_publication_select on public.tournament_standings_publication;
create policy tournament_standings_publication_select on public.tournament_standings_publication
  for select to authenticated using (true);

-- Admin standings RPCs now key by edition_id.

drop function if exists public.admin_upsert_group_result(uuid, text, jsonb);
create or replace function public.admin_upsert_group_result(
  p_edition_id uuid,
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

  insert into public.tournament_group_results (edition_id, group_id, rankings, updated_by)
  values (p_edition_id, p_group_id, p_rankings, auth.uid())
  on conflict (edition_id, group_id)
  do update set rankings = excluded.rankings, updated_by = excluded.updated_by, updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_upsert_group_result(uuid, text, jsonb) to authenticated;

drop function if exists public.admin_upsert_match_result(uuid, text, text);
create or replace function public.admin_upsert_match_result(
  p_edition_id uuid,
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

  insert into public.tournament_match_results (edition_id, match_id, winner_id, updated_by)
  values (p_edition_id, p_match_id, p_winner_id, auth.uid())
  on conflict (edition_id, match_id)
  do update set winner_id = excluded.winner_id, updated_by = excluded.updated_by, updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_upsert_match_result(uuid, text, text) to authenticated;

drop function if exists public.admin_upsert_tiebreakers(uuid, integer, text);
create or replace function public.admin_upsert_tiebreakers(
  p_edition_id uuid,
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

  insert into public.tournament_tiebreakers (edition_id, total_goals, top_scorer, updated_by)
  values (p_edition_id, p_total_goals, coalesce(p_top_scorer, ''), auth.uid())
  on conflict (edition_id)
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

drop function if exists public.admin_get_tournament_results(uuid);
create or replace function public.admin_get_edition_results(p_edition_id uuid)
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
      (select to_jsonb(tb) - 'edition_id'
       from public.tournament_tiebreakers tb
       where tb.edition_id = p_edition_id),
      'null'::jsonb
    );
end;
$$;

grant execute on function public.admin_get_edition_results(uuid) to authenticated;

drop function if exists public.admin_get_standings_editor(uuid);
create or replace function public.admin_get_standings_editor(p_edition_id uuid)
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
    (select pub.published_at
     from public.tournament_standings_publication pub
     where pub.edition_id = p_edition_id),
    (select greatest(
       coalesce((select max(g2.updated_at)
                 from public.tournament_group_results g2
                 where g2.edition_id = p_edition_id), 'epoch'::timestamptz),
       coalesce((select max(m2.updated_at)
                 from public.tournament_match_results m2
                 where m2.edition_id = p_edition_id), 'epoch'::timestamptz)
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

  insert into public.tournament_standings_publication
    (edition_id, published_at, published_by)
  values (p_edition_id, v_now, auth.uid())
  on conflict (edition_id)
  do update set published_at = excluded.published_at,
                published_by = excluded.published_by;

  return v_now;
end;
$$;

grant execute on function public.admin_publish_standings_update(uuid) to authenticated;

-- User-facing standings RPCs keep their tournament_id signature; internally
-- they look up the tournament's edition.

drop function if exists public.get_tournament_published_standings(uuid);
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
declare
  v_edition_id uuid;
begin
  if not public.user_can_access_tournament(p_tournament_id, auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select t.edition_id into v_edition_id
  from public.tournaments t
  where t.id = p_tournament_id;

  return query
  select
    coalesce(
      (select jsonb_object_agg(gp.group_id, gp.rankings)
       from public.tournament_group_results_published gp
       where gp.edition_id = v_edition_id),
      '{}'::jsonb
    ),
    coalesce(
      (select jsonb_object_agg(mp.match_id, mp.winner_id)
       from public.tournament_match_results_published mp
       where mp.edition_id = v_edition_id),
      '{}'::jsonb
    ),
    (select pub.published_at
     from public.tournament_standings_publication pub
     where pub.edition_id = v_edition_id);
end;
$$;

grant execute on function public.get_tournament_published_standings(uuid) to authenticated;

drop function if exists public.get_tournament_leaderboard(uuid);
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
declare
  v_edition_id uuid;
begin
  if not public.user_can_access_tournament(p_tournament_id, auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select t.edition_id into v_edition_id
  from public.tournaments t
  where t.id = p_tournament_id;

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
     where pub.edition_id = v_edition_id)
  from scored s
  left join public.profiles p on p.id = s.user_id
  order by s.total_points desc, p.display_name nulls last, p.email nulls last;
end;
$$;

grant execute on function public.get_tournament_leaderboard(uuid) to authenticated;

-- Tournament overview drops the per-tournament results stats (they belong
-- to the edition now) and exposes the linked edition.
drop function if exists public.admin_list_tournaments_overview();
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
  select
    t.id,
    t.name,
    t.visibility,
    t.status,
    t.starts_at,
    t.locks_at,
    now() >= t.locks_at as is_locked,
    t.edition_id,
    e.name,
    coalesce(m.cnt, 0),
    coalesce(b.cnt, 0),
    t.created_at
  from public.tournaments t
  left join public.tournament_editions e on e.id = t.edition_id
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
  order by t.created_at desc;
end;
$$;

grant execute on function public.admin_list_tournaments_overview() to authenticated;

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
  select
    e.id,
    e.name,
    coalesce(tc.cnt, 0),
    coalesce(gr.cnt, 0),
    coalesce(mr.cnt, 0),
    (tb.edition_id is not null),
    pub.published_at,
    e.created_at
  from public.tournament_editions e
  left join (
    select edition_id, count(*) as cnt
    from public.tournaments
    group by edition_id
  ) tc on tc.edition_id = e.id
  left join (
    select edition_id, count(*) as cnt
    from public.tournament_group_results
    group by edition_id
  ) gr on gr.edition_id = e.id
  left join (
    select edition_id, count(*) as cnt
    from public.tournament_match_results
    where winner_id is not null
    group by edition_id
  ) mr on mr.edition_id = e.id
  left join public.tournament_tiebreakers tb on tb.edition_id = e.id
  left join public.tournament_standings_publication pub on pub.edition_id = e.id
  order by e.created_at;
end;
$$;

grant execute on function public.admin_list_editions_overview() to authenticated;

create or replace function public.admin_create_edition(p_name text)
returns public.tournament_editions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.tournament_editions;
begin
  if not public.is_global_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  insert into public.tournament_editions (name)
  values (p_name)
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.admin_create_edition(text) to authenticated;

-- admin_upsert_tournament gains an edition_id parameter. When omitted, it
-- defaults to the single existing edition; if multiple editions exist the
-- caller must supply one explicitly.
drop function if exists public.admin_upsert_tournament(
  uuid, text, public.tournament_visibility, public.tournament_status, timestamptz, timestamptz
);
create or replace function public.admin_upsert_tournament(
  p_id uuid,
  p_name text,
  p_visibility public.tournament_visibility,
  p_status public.tournament_status,
  p_starts_at timestamptz,
  p_locks_at timestamptz,
  p_edition_id uuid default null
)
returns public.tournaments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.tournaments;
  v_edition_id uuid;
begin
  if not public.is_global_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if p_edition_id is null then
    if (select count(*) from public.tournament_editions) <> 1 then
      raise exception 'edition_id is required when there is not exactly one edition';
    end if;
    select id into v_edition_id from public.tournament_editions limit 1;
  else
    v_edition_id := p_edition_id;
  end if;

  if p_id is null then
    insert into public.tournaments (name, visibility, status, starts_at, locks_at, created_by, edition_id)
    values (p_name, p_visibility, p_status, p_starts_at, p_locks_at, auth.uid(), v_edition_id)
    returning * into v_row;
  else
    update public.tournaments
    set name = p_name,
        visibility = p_visibility,
        status = p_status,
        starts_at = p_starts_at,
        locks_at = p_locks_at,
        edition_id = v_edition_id
    where id = p_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function public.admin_upsert_tournament(
  uuid, text, public.tournament_visibility, public.tournament_status, timestamptz, timestamptz, uuid
) to authenticated;
