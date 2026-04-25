-- Ensure signed-in users can access tables/functions, with RLS still enforcing row-level restrictions.

grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to authenticated;
grant all privileges on all sequences in schema public to service_role;

grant execute on all functions in schema public to authenticated;
grant execute on all functions in schema public to service_role;

-- Keep future migrations from breaking for missing grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all privileges on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant all privileges on sequences to service_role;

alter default privileges in schema public
  grant execute on functions to authenticated;
alter default privileges in schema public
  grant execute on functions to service_role;
