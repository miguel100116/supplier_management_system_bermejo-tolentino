-- Read-only preflight for the normalized Supplier Management System migration.
-- Run this in the target project's SQL Editor before applying any migration.
-- It does not create, alter, or delete database objects or records.

with expected_tables(table_name) as (
  values
    ('import_source_files'),
    ('companies'),
    ('company_branches'),
    ('company_documents'),
    ('evaluation_forms'),
    ('evaluation_questions'),
    ('evaluators'),
    ('company_aliases'),
    ('evaluation_submissions'),
    ('evaluation_answers')
)
select
  table_name,
  to_regclass(format('public.%I', table_name)) is not null as already_exists
from expected_tables
order by table_name;

select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'suppliers',
    'survey_responses',
    'import_source_files',
    'companies',
    'company_branches',
    'company_documents',
    'evaluation_forms',
    'evaluation_questions',
    'evaluators',
    'company_aliases',
    'evaluation_submissions',
    'evaluation_answers'
  )
order by table_name, ordinal_position;

select
  cls.relname as table_name,
  con.conname as constraint_name,
  case con.contype
    when 'p' then 'PRIMARY KEY'
    when 'f' then 'FOREIGN KEY'
    when 'u' then 'UNIQUE'
    when 'c' then 'CHECK'
    when 'x' then 'EXCLUSION'
    else con.contype::text
  end as constraint_type,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cls on cls.oid = con.conrelid
join pg_namespace nsp on nsp.oid = cls.relnamespace
where nsp.nspname = 'public'
  and cls.relname in (
    'suppliers',
    'survey_responses',
    'import_source_files',
    'companies',
    'company_branches',
    'company_documents',
    'evaluation_forms',
    'evaluation_questions',
    'evaluators',
    'company_aliases',
    'evaluation_submissions',
    'evaluation_answers'
  )
order by cls.relname, con.conname;

select tablename as table_name, indexname as index_name, indexdef as definition
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'suppliers',
    'survey_responses',
    'import_source_files',
    'companies',
    'company_branches',
    'company_documents',
    'evaluation_forms',
    'evaluation_questions',
    'evaluators',
    'company_aliases',
    'evaluation_submissions',
    'evaluation_answers'
  )
order by tablename, indexname;

select
  schemaname,
  tablename as table_name,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'suppliers',
    'survey_responses',
    'import_source_files',
    'companies',
    'company_branches',
    'company_documents',
    'evaluation_forms',
    'evaluation_questions',
    'evaluators',
    'company_aliases',
    'evaluation_submissions',
    'evaluation_answers'
  )
order by tablename, policyname;

select
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'suppliers',
    'survey_responses',
    'import_source_files',
    'companies',
    'company_branches',
    'company_documents',
    'evaluation_forms',
    'evaluation_questions',
    'evaluators',
    'company_aliases',
    'evaluation_submissions',
    'evaluation_answers'
  )
order by table_name, grantee, privilege_type;

-- These are PostgreSQL planner estimates, not authoritative counts. They are
-- included only to identify unexpectedly populated target tables without
-- issuing dynamic SQL against tables that may not exist yet.
select relname as table_name, n_live_tup as estimated_rows
from pg_stat_user_tables
where schemaname = 'public'
  and relname in (
    'suppliers',
    'survey_responses',
    'import_source_files',
    'companies',
    'company_branches',
    'company_documents',
    'evaluation_forms',
    'evaluation_questions',
    'evaluators',
    'company_aliases',
    'evaluation_submissions',
    'evaluation_answers'
  )
order by relname;
