-- Make RLS helper functions SECURITY DEFINER so they bypass RLS when reading
-- tournament_admins / tournament_memberships. Without this, the policies on
-- those tables call the same helpers, producing infinite recursion and a
-- "stack depth limit exceeded" error when inserting brackets or memberships.

create or replace function public.is_global_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(select 1 from public.tournament_admins ta where ta.user_id = uid);
$$;

create or replace function public.user_can_access_tournament(tid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
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
security definer
set search_path = public, pg_temp
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

grant execute on function public.is_global_admin(uuid) to authenticated;
grant execute on function public.user_can_access_tournament(uuid, uuid) to authenticated;
grant execute on function public.user_can_manage_tournament(uuid, uuid) to authenticated;
