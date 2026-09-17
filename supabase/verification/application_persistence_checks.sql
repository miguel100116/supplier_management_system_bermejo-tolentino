-- Read-only staging checks for the shared application persistence layer.

select record_type, count(*) as row_count
from public.application_records
group by record_type
order by record_type;

select role, count(*) as profile_count
from public.app_profiles
group by role
order by role;

select record_type, record_id, count(*) as duplicate_count
from public.application_records
group by record_type, record_id
having count(*) > 1;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('app_profiles', 'application_records')
order by c.relname;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('app_profiles', 'application_records')
order by tablename, policyname;
