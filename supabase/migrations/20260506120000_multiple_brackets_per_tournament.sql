-- Allow tournaments to opt into multiple brackets per participant.
-- A max of 1 preserves the existing one-bracket behavior.

alter table public.tournaments
  add column if not exists max_brackets_per_user integer not null default 1;

do $$
begin
  alter table public.tournaments
    add constraint tournaments_max_brackets_per_user_check
    check (max_brackets_per_user >= 1);
exception
  when duplicate_object then null;
end $$;

alter table public.brackets
  drop constraint if exists brackets_tournament_id_user_id_key;

create or replace function public.enforce_user_bracket_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max integer;
  v_existing_count integer;
begin
  if tg_op = 'UPDATE'
    and new.tournament_id = old.tournament_id
    and new.user_id = old.user_id then
    return new;
  end if;

  select t.max_brackets_per_user
    into v_max
  from public.tournaments t
  where t.id = new.tournament_id;

  if v_max is null then
    raise exception 'Tournament not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.tournament_id::text || ':' || new.user_id::text, 0));

  if tg_op = 'INSERT' then
    select count(*)::integer
      into v_existing_count
    from public.brackets b
    where b.tournament_id = new.tournament_id
      and b.user_id = new.user_id;
  else
    select count(*)::integer
      into v_existing_count
    from public.brackets b
    where b.tournament_id = new.tournament_id
      and b.user_id = new.user_id
      and b.id <> old.id;
  end if;

  if v_existing_count >= v_max then
    raise exception 'Bracket limit reached for this tournament.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_brackets_user_limit on public.brackets;
create trigger trg_brackets_user_limit
before insert or update of tournament_id, user_id on public.brackets
for each row execute function public.enforce_user_bracket_limit();

create or replace function public.create_tournament_bracket(
  p_tournament_id uuid,
  p_name text
)
returns public.brackets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_name text;
  v_tournament public.tournaments%rowtype;
  v_existing_count integer;
  v_row public.brackets;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_name := trim(coalesce(p_name, ''));
  if v_name = '' then
    raise exception 'Bracket name is required.';
  end if;

  select *
    into v_tournament
  from public.tournaments t
  where t.id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if now() >= v_tournament.locks_at then
    raise exception 'This tournament is already locked.';
  end if;

  if not exists (
    select 1
    from public.tournament_memberships tm
    where tm.tournament_id = p_tournament_id
      and tm.user_id = v_uid
  ) then
    raise exception 'Join this tournament before creating a bracket.';
  end if;

  select count(*)::integer
    into v_existing_count
  from public.brackets b
  where b.tournament_id = p_tournament_id
    and b.user_id = v_uid;

  if v_existing_count >= v_tournament.max_brackets_per_user then
    raise exception 'Bracket limit reached for this tournament.';
  end if;

  if exists (
    select 1
    from public.brackets b
    where b.tournament_id = p_tournament_id
      and b.user_id = v_uid
      and public.normalize_tournament_name(b.name) = public.normalize_tournament_name(v_name)
  ) then
    raise exception 'You already have a bracket with that name in this tournament.';
  end if;

  insert into public.brackets (tournament_id, user_id, name)
  values (p_tournament_id, v_uid, v_name)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_tournament_bracket(uuid, text) to authenticated;

drop function if exists public.get_user_tournament_contexts();
create or replace function public.get_user_tournament_contexts()
returns table (
  tournament_id uuid,
  tournament_name text,
  tournament_slug text,
  visibility public.tournament_visibility,
  status public.tournament_status,
  starts_at timestamptz,
  locks_at timestamptz,
  is_locked boolean,
  is_member boolean,
  membership_role public.membership_role,
  max_brackets_per_user integer,
  user_bracket_count bigint,
  bracket_id uuid,
  bracket_name text,
  bracket_updated_at timestamptz,
  brackets jsonb
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with auth_ctx as (
    select auth.uid() as uid
  ),
  user_brackets as (
    select
      b.tournament_id,
      b.user_id,
      count(*) as bracket_count,
      jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'current_step', b.current_step,
          'furthest_step', b.furthest_step,
          'created_at', b.created_at,
          'updated_at', b.updated_at
        )
        order by b.updated_at desc
      ) as brackets
    from public.brackets b
    cross join auth_ctx u
    where b.user_id = u.uid
    group by b.tournament_id, b.user_id
  ),
  latest_brackets as (
    select distinct on (b.tournament_id, b.user_id)
      b.tournament_id,
      b.user_id,
      b.id,
      b.name,
      b.updated_at
    from public.brackets b
    cross join auth_ctx u
    where b.user_id = u.uid
    order by b.tournament_id, b.user_id, b.updated_at desc
  )
  select
    t.id as tournament_id,
    t.name as tournament_name,
    t.slug as tournament_slug,
    t.visibility,
    t.status,
    t.starts_at,
    t.locks_at,
    now() >= t.locks_at as is_locked,
    (tm.user_id is not null) as is_member,
    tm.role as membership_role,
    t.max_brackets_per_user,
    coalesce(ub.bracket_count, 0) as user_bracket_count,
    lb.id as bracket_id,
    lb.name as bracket_name,
    lb.updated_at as bracket_updated_at,
    coalesce(ub.brackets, '[]'::jsonb) as brackets
  from public.tournaments t
  cross join auth_ctx u
  left join public.tournament_memberships tm
    on tm.tournament_id = t.id
    and tm.user_id = u.uid
  left join user_brackets ub
    on ub.tournament_id = t.id
    and ub.user_id = u.uid
  left join latest_brackets lb
    on lb.tournament_id = t.id
    and lb.user_id = u.uid
  where u.uid is not null
    and (
      t.visibility = 'public'
      or tm.user_id is not null
      or public.is_global_admin(u.uid)
    )
  order by t.visibility asc, t.name asc;
$$;

grant execute on function public.get_user_tournament_contexts() to authenticated;

drop function if exists public.admin_upsert_tournament(
  uuid, text, public.tournament_visibility, public.tournament_status, timestamptz, timestamptz, uuid
);
create or replace function public.admin_upsert_tournament(
  p_id uuid,
  p_name text,
  p_visibility public.tournament_visibility,
  p_status public.tournament_status,
  p_starts_at timestamptz,
  p_locks_at timestamptz,
  p_edition_id uuid default null,
  p_max_brackets_per_user integer default 1
)
returns public.tournaments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.tournaments;
  v_edition_id uuid;
  v_max integer;
begin
  if not public.is_global_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  v_max := coalesce(p_max_brackets_per_user, 1);
  if v_max < 1 then
    raise exception 'max_brackets_per_user must be at least 1';
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
    insert into public.tournaments (
      name,
      visibility,
      status,
      starts_at,
      locks_at,
      created_by,
      edition_id,
      max_brackets_per_user
    )
    values (
      p_name,
      p_visibility,
      p_status,
      p_starts_at,
      p_locks_at,
      auth.uid(),
      v_edition_id,
      v_max
    )
    returning * into v_row;
  else
    update public.tournaments
    set name = p_name,
        visibility = p_visibility,
        status = p_status,
        starts_at = p_starts_at,
        locks_at = p_locks_at,
        edition_id = v_edition_id,
        max_brackets_per_user = v_max
    where id = p_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function public.admin_upsert_tournament(
  uuid,
  text,
  public.tournament_visibility,
  public.tournament_status,
  timestamptz,
  timestamptz,
  uuid,
  integer
) to authenticated;

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
  max_brackets_per_user integer,
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
  with members as (
    select tm.tournament_id as tid, count(*) as cnt
    from public.tournament_memberships tm
    group by tm.tournament_id
  ),
  brackets_count as (
    select b.tournament_id as tid, count(*) as cnt
    from public.brackets b
    group by b.tournament_id
  )
  select
    t.id,
    t.name,
    t.visibility,
    t.status,
    t.starts_at,
    t.locks_at,
    now() >= t.locks_at,
    t.edition_id,
    e.name,
    t.max_brackets_per_user,
    coalesce(m.cnt, 0),
    coalesce(bc.cnt, 0),
    t.created_at
  from public.tournaments t
  left join public.tournament_editions e on e.id = t.edition_id
  left join members m on m.tid = t.id
  left join brackets_count bc on bc.tid = t.id
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
  order by p.display_name nulls last, p.email nulls last, b.updated_at desc nulls last;
end;
$$;

grant execute on function public.admin_list_tournament_members(uuid) to authenticated;
