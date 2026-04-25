-- Tournament-aware persistence layer with public/private tournaments and bracket persistence.

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_tournament_name(input_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(coalesce(input_name, ''))), '\\s+', ' ', 'g');
$$;

do $$
begin
  create type public.tournament_visibility as enum ('public', 'private');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.tournament_status as enum ('draft', 'open', 'locked', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.membership_role as enum ('admin', 'participant');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  normalized_name text not null,
  visibility public.tournament_visibility not null default 'public',
  status public.tournament_status not null default 'draft',
  starts_at timestamptz,
  locks_at timestamptz not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tournaments add column if not exists normalized_name text;
alter table public.tournaments add column if not exists visibility public.tournament_visibility not null default 'public';
alter table public.tournaments add column if not exists status public.tournament_status not null default 'draft';
update public.tournaments set normalized_name = public.normalize_tournament_name(name) where normalized_name is null;
alter table public.tournaments alter column normalized_name set not null;

create unique index if not exists tournaments_normalized_name_key on public.tournaments(normalized_name);

create table if not exists public.tournament_memberships (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'participant',
  joined_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create table if not exists public.brackets (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'draft',
  current_step text not null default 'groups',
  furthest_step text not null default 'groups',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

alter table public.brackets add column if not exists current_step text not null default 'groups';
alter table public.brackets add column if not exists furthest_step text not null default 'groups';

create table if not exists public.bracket_group_rankings (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.brackets(id) on delete cascade,
  group_id text not null,
  rankings jsonb not null,
  updated_at timestamptz not null default now(),
  unique (bracket_id, group_id)
);

create table if not exists public.bracket_knockout_picks (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.brackets(id) on delete cascade,
  selected_third_place jsonb not null default '[]'::jsonb,
  third_place_assignment jsonb not null default '{}'::jsonb,
  matches jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (bracket_id)
);

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

create or replace function public.set_tournament_normalized_name()
returns trigger
language plpgsql
as $$
begin
  new.normalized_name = public.normalize_tournament_name(new.name);
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_tournaments_normalize_name on public.tournaments;
create trigger trg_tournaments_normalize_name
before insert or update of name on public.tournaments
for each row execute function public.set_tournament_normalized_name();

drop trigger if exists trg_tournaments_updated_at on public.tournaments;
create trigger trg_tournaments_updated_at
before update on public.tournaments
for each row execute function public.touch_updated_at();

drop trigger if exists trg_brackets_updated_at on public.brackets;
create trigger trg_brackets_updated_at
before update on public.brackets
for each row execute function public.touch_updated_at();

create or replace function public.is_global_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists(select 1 from public.tournament_admins ta where ta.user_id = uid);
$$;

create or replace function public.user_can_access_tournament(tid uuid, uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tournaments t
    left join public.tournament_memberships tm
      on tm.tournament_id = t.id
      and tm.user_id = uid
    where t.id = tid
      and (
        t.visibility = 'public'
        or tm.user_id is not null
        or public.is_global_admin(uid)
      )
  );
$$;

create or replace function public.user_can_manage_tournament(tid uuid, uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tournaments t
    left join public.tournament_memberships tm
      on tm.tournament_id = t.id
      and tm.user_id = uid
      and tm.role = 'admin'
    where t.id = tid
      and (
        public.is_global_admin(uid)
        or t.created_by = uid
        or tm.user_id is not null
      )
  );
$$;

create or replace function public.enforce_bracket_lock_date()
returns trigger
language plpgsql
as $$
declare
  acting_user uuid;
  related_tournament_id uuid;
  lock_time timestamptz;
begin
  acting_user := auth.uid();

  if tg_table_name = 'brackets' then
    related_tournament_id := coalesce(new.tournament_id, old.tournament_id);
  else
    select b.tournament_id
      into related_tournament_id
    from public.brackets b
    where b.id = coalesce(new.bracket_id, old.bracket_id);
  end if;

  if related_tournament_id is null then
    raise exception 'Tournament context missing';
  end if;

  select t.locks_at into lock_time
  from public.tournaments t
  where t.id = related_tournament_id;

  if lock_time is null then
    raise exception 'Tournament lock date missing';
  end if;

  if now() >= lock_time and not public.is_global_admin(acting_user) then
    raise exception 'Bracket is locked';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_brackets_lock on public.brackets;
create trigger trg_brackets_lock
before insert or update or delete on public.brackets
for each row execute function public.enforce_bracket_lock_date();

drop trigger if exists trg_rankings_lock on public.bracket_group_rankings;
create trigger trg_rankings_lock
before insert or update or delete on public.bracket_group_rankings
for each row execute function public.enforce_bracket_lock_date();

drop trigger if exists trg_knockout_lock on public.bracket_knockout_picks;
create trigger trg_knockout_lock
before insert or update or delete on public.bracket_knockout_picks
for each row execute function public.enforce_bracket_lock_date();

alter table public.profiles enable row level security;
alter table public.tournament_admins enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_memberships enable row level security;
alter table public.brackets enable row level security;
alter table public.bracket_group_rankings enable row level security;
alter table public.bracket_knockout_picks enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists tournament_admins_admin_only on public.tournament_admins;
create policy tournament_admins_admin_only on public.tournament_admins
for all to authenticated
using (public.is_global_admin(auth.uid()))
with check (public.is_global_admin(auth.uid()));

drop policy if exists tournaments_select_accessible on public.tournaments;
create policy tournaments_select_accessible on public.tournaments
for select to authenticated
using (public.user_can_access_tournament(id, auth.uid()));

drop policy if exists tournaments_manage_admin on public.tournaments;
create policy tournaments_manage_admin on public.tournaments
for all to authenticated
using (public.is_global_admin(auth.uid()))
with check (public.is_global_admin(auth.uid()));

drop policy if exists memberships_select_self_or_admin on public.tournament_memberships;
create policy memberships_select_self_or_admin on public.tournament_memberships
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_global_admin(auth.uid())
  or public.user_can_manage_tournament(tournament_id, auth.uid())
);

drop policy if exists memberships_manage_admin on public.tournament_memberships;
create policy memberships_manage_admin on public.tournament_memberships
for all to authenticated
using (public.user_can_manage_tournament(tournament_id, auth.uid()))
with check (public.user_can_manage_tournament(tournament_id, auth.uid()));

drop policy if exists brackets_select_own_or_admin on public.brackets;
create policy brackets_select_own_or_admin on public.brackets
for select to authenticated
using (
  user_id = auth.uid()
  or public.user_can_manage_tournament(tournament_id, auth.uid())
);

drop policy if exists brackets_insert_own on public.brackets;
create policy brackets_insert_own on public.brackets
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.tournament_memberships tm
    where tm.tournament_id = brackets.tournament_id
      and tm.user_id = auth.uid()
  )
);

drop policy if exists brackets_update_own_or_admin on public.brackets;
create policy brackets_update_own_or_admin on public.brackets
for update to authenticated
using (
  user_id = auth.uid()
  or public.user_can_manage_tournament(tournament_id, auth.uid())
)
with check (
  user_id = auth.uid()
  or public.user_can_manage_tournament(tournament_id, auth.uid())
);

drop policy if exists bracket_group_rankings_select on public.bracket_group_rankings;
create policy bracket_group_rankings_select on public.bracket_group_rankings
for select to authenticated
using (
  exists (
    select 1
    from public.brackets b
    where b.id = bracket_group_rankings.bracket_id
      and (
        b.user_id = auth.uid()
        or public.user_can_manage_tournament(b.tournament_id, auth.uid())
      )
  )
);

drop policy if exists bracket_group_rankings_modify on public.bracket_group_rankings;
create policy bracket_group_rankings_modify on public.bracket_group_rankings
for all to authenticated
using (
  exists (
    select 1
    from public.brackets b
    where b.id = bracket_group_rankings.bracket_id
      and (
        b.user_id = auth.uid()
        or public.user_can_manage_tournament(b.tournament_id, auth.uid())
      )
  )
)
with check (
  exists (
    select 1
    from public.brackets b
    where b.id = bracket_group_rankings.bracket_id
      and (
        b.user_id = auth.uid()
        or public.user_can_manage_tournament(b.tournament_id, auth.uid())
      )
  )
);

drop policy if exists bracket_knockout_picks_select on public.bracket_knockout_picks;
create policy bracket_knockout_picks_select on public.bracket_knockout_picks
for select to authenticated
using (
  exists (
    select 1
    from public.brackets b
    where b.id = bracket_knockout_picks.bracket_id
      and (
        b.user_id = auth.uid()
        or public.user_can_manage_tournament(b.tournament_id, auth.uid())
      )
  )
);

drop policy if exists bracket_knockout_picks_modify on public.bracket_knockout_picks;
create policy bracket_knockout_picks_modify on public.bracket_knockout_picks
for all to authenticated
using (
  exists (
    select 1
    from public.brackets b
    where b.id = bracket_knockout_picks.bracket_id
      and (
        b.user_id = auth.uid()
        or public.user_can_manage_tournament(b.tournament_id, auth.uid())
      )
  )
)
with check (
  exists (
    select 1
    from public.brackets b
    where b.id = bracket_knockout_picks.bracket_id
      and (
        b.user_id = auth.uid()
        or public.user_can_manage_tournament(b.tournament_id, auth.uid())
      )
  )
);

create or replace function public.join_public_tournament(p_tournament_id uuid)
returns public.tournament_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_tournament public.tournaments%rowtype;
  v_membership public.tournament_memberships%rowtype;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_tournament
  from public.tournaments t
  where t.id = p_tournament_id
    and t.visibility = 'public';

  if not found then
    raise exception 'Tournament not found';
  end if;

  insert into public.tournament_memberships (tournament_id, user_id, role)
  values (v_tournament.id, v_uid, 'participant')
  on conflict (tournament_id, user_id) do nothing
  returning * into v_membership;

  if v_membership.id is null then
    select * into v_membership
    from public.tournament_memberships tm
    where tm.tournament_id = v_tournament.id
      and tm.user_id = v_uid;
  end if;

  return v_membership;
end;
$$;

grant execute on function public.join_public_tournament(uuid) to authenticated;

create or replace function public.join_private_tournament_by_name(input_name text)
returns public.tournament_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_tournament public.tournaments%rowtype;
  v_membership public.tournament_memberships%rowtype;
  v_name text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_name := public.normalize_tournament_name(input_name);

  select * into v_tournament
  from public.tournaments t
  where t.visibility = 'private'
    and t.normalized_name = v_name;

  if not found then
    raise exception 'Tournament not found';
  end if;

  insert into public.tournament_memberships (tournament_id, user_id, role)
  values (v_tournament.id, v_uid, 'participant')
  on conflict (tournament_id, user_id) do nothing
  returning * into v_membership;

  if v_membership.id is null then
    select * into v_membership
    from public.tournament_memberships tm
    where tm.tournament_id = v_tournament.id
      and tm.user_id = v_uid;
  end if;

  return v_membership;
exception
  when others then
    raise exception 'Tournament not found';
end;
$$;

grant execute on function public.join_private_tournament_by_name(text) to authenticated;

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
  bracket_id uuid,
  bracket_name text,
  bracket_updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with auth_ctx as (
    select auth.uid() as uid
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
    b.id as bracket_id,
    b.name as bracket_name,
    b.updated_at as bracket_updated_at
  from public.tournaments t
  cross join auth_ctx u
  left join public.tournament_memberships tm
    on tm.tournament_id = t.id
    and tm.user_id = u.uid
  left join public.brackets b
    on b.tournament_id = t.id
    and b.user_id = u.uid
  where u.uid is not null
    and (
      t.visibility = 'public'
      or tm.user_id is not null
      or public.is_global_admin(u.uid)
    )
  order by t.visibility asc, t.name asc;
$$;

grant execute on function public.get_user_tournament_contexts() to authenticated;
