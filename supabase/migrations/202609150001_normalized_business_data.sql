-- Supplier Management System normalized business-data schema.
--
-- LOCAL PREPARATION ONLY as of 2026-09-15. This migration has not been
-- applied to any Supabase project. It is intentionally additive: it does not
-- drop, truncate, delete from, rename, or alter the existing suppliers or
-- survey_responses tables.

create table if not exists public.import_source_files (
  id uuid primary key,
  source_key text not null unique,
  file_name text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  source_record_count integer not null check (source_record_count >= 0),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key,
  canonical_name text not null,
  source_name_key text not null unique,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_normalized_name_idx
  on public.companies (normalized_name);

create table if not exists public.company_branches (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  source_file_id uuid not null references public.import_source_files(id),
  source_record_key text not null unique,
  source_row_number integer not null check (source_row_number > 0),
  source_sequence text,
  bp_code text,
  spend_tier text,
  po_activity text,
  po_count_raw text,
  po_count integer,
  remarks text,
  status text,
  category_raw text,
  partner_type text check (partner_type in ('Courier', 'Supplier', 'Subcontractor')),
  supplier_origin text check (supplier_origin in ('Local', 'Foreign')),
  supplier_rank_raw text,
  supplier_rank integer,
  address text,
  credit_line text,
  federal_tax_id text,
  industry text,
  contact_person text,
  contact_position text,
  mobile_phone text,
  email text,
  date_accredited_raw text,
  date_accredited date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists company_branches_bp_code_uidx
  on public.company_branches (bp_code)
  where bp_code is not null;
create index if not exists company_branches_company_id_idx
  on public.company_branches (company_id);
create index if not exists company_branches_partner_type_idx
  on public.company_branches (partner_type);

create table if not exists public.company_documents (
  id uuid primary key,
  branch_id uuid not null references public.company_branches(id),
  document_key text not null,
  document_label text not null,
  supplier_section text not null check (supplier_section in ('Common', 'Local', 'Foreign')),
  raw_value text,
  expiry_date date,
  status text,
  days_left_raw text,
  days_left integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, document_key)
);

create index if not exists company_documents_branch_id_idx
  on public.company_documents (branch_id);
create index if not exists company_documents_expiry_date_idx
  on public.company_documents (expiry_date);

create table if not exists public.evaluation_forms (
  code text primary key check (code in ('Courier', 'Supplier', 'Subcontractor')),
  source_file_id uuid not null unique references public.import_source_files(id),
  source_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evaluation_questions (
  id uuid primary key,
  form_code text not null references public.evaluation_forms(code),
  question_key text not null,
  canonical_question_key text,
  question_number numeric,
  display_order integer not null check (display_order > 0),
  answer_kind text not null check (answer_kind in ('rating', 'text', 'remark')),
  category text not null,
  question_text text not null,
  source_header text not null,
  max_points numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_code, question_key),
  unique (form_code, display_order)
);

create index if not exists evaluation_questions_form_code_idx
  on public.evaluation_questions (form_code);

create table if not exists public.evaluators (
  id uuid primary key,
  email text not null,
  normalized_email text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_aliases (
  id uuid primary key,
  form_code text not null references public.evaluation_forms(code),
  source_name text not null,
  normalized_source_name text not null,
  company_id uuid not null references public.companies(id),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_code, normalized_source_name)
);

create index if not exists company_aliases_company_id_idx
  on public.company_aliases (company_id);

create table if not exists public.evaluation_submissions (
  id uuid primary key,
  source_file_id uuid not null references public.import_source_files(id),
  source_record_id text not null,
  form_code text not null references public.evaluation_forms(code),
  company_id uuid not null references public.companies(id),
  evaluator_id uuid references public.evaluators(id),
  company_name_raw text not null,
  evaluator_name_raw text,
  respondent_email_raw text,
  respondent_designation text,
  respondent_department text,
  company_address_raw text,
  started_at_raw text,
  submitted_at_raw text,
  started_at timestamp without time zone,
  submitted_at timestamp without time zone not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_file_id, source_record_id)
);

create index if not exists evaluation_submissions_company_id_idx
  on public.evaluation_submissions (company_id);
create index if not exists evaluation_submissions_evaluator_id_idx
  on public.evaluation_submissions (evaluator_id);
create index if not exists evaluation_submissions_form_code_idx
  on public.evaluation_submissions (form_code);
create index if not exists evaluation_submissions_submitted_at_idx
  on public.evaluation_submissions (submitted_at);

create table if not exists public.evaluation_answers (
  id uuid primary key,
  submission_id uuid not null references public.evaluation_submissions(id),
  question_id uuid not null references public.evaluation_questions(id),
  answer_status text not null check (
    answer_status in ('rated', 'not_applicable', 'populated', 'missing')
  ),
  rating_value numeric,
  text_value text,
  raw_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id),
  check (
    (answer_status = 'rated' and rating_value is not null and text_value is null)
    or (answer_status = 'not_applicable' and rating_value is null and text_value is null)
    or (answer_status = 'populated' and rating_value is null and text_value is not null)
    or (answer_status = 'missing' and rating_value is null and text_value is null)
  )
);

create index if not exists evaluation_answers_submission_id_idx
  on public.evaluation_answers (submission_id);
create index if not exists evaluation_answers_question_id_idx
  on public.evaluation_answers (question_id);

-- RLS is enabled now, but no browser-facing policies are introduced in this
-- migration. The server-side importer uses a locally supplied service-role
-- credential. Authenticated application policies must be added only after
-- the actual Entra/Supabase JWT claims and access rules are verified.
alter table public.import_source_files enable row level security;
alter table public.companies enable row level security;
alter table public.company_branches enable row level security;
alter table public.company_documents enable row level security;
alter table public.evaluation_forms enable row level security;
alter table public.evaluation_questions enable row level security;
alter table public.evaluators enable row level security;
alter table public.company_aliases enable row level security;
alter table public.evaluation_submissions enable row level security;
alter table public.evaluation_answers enable row level security;

revoke all on public.import_source_files from anon, authenticated;
revoke all on public.companies from anon, authenticated;
revoke all on public.company_branches from anon, authenticated;
revoke all on public.company_documents from anon, authenticated;
revoke all on public.evaluation_forms from anon, authenticated;
revoke all on public.evaluation_questions from anon, authenticated;
revoke all on public.evaluators from anon, authenticated;
revoke all on public.company_aliases from anon, authenticated;
revoke all on public.evaluation_submissions from anon, authenticated;
revoke all on public.evaluation_answers from anon, authenticated;
