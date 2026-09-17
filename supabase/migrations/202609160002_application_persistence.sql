-- Shared application persistence for staging.
--
-- This migration is additive. The imported normalized tables remain the
-- immutable source/audit layer; application_records becomes the canonical
-- editable store used by the current frontend contract. Records are kept per
-- entity (not as one global JSON blob) to avoid unrelated users overwriting
-- each other's submissions.

create table if not exists public.app_profiles (
  email text primary key check (email = lower(email)),
  user_id uuid unique references auth.users(id) on delete set null,
  role text not null default 'Employee' check (role in ('Admin', 'Employee')),
  designation text not null default 'Rank & File' check (
    designation in ('Rank & File', 'Supervisory', 'Managerial', 'Director', 'Executive')
  ),
  department text not null default 'Logistics',
  permission_pages text[],
  permission_survey_types text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.application_records (
  record_type text not null check (record_type in (
    'partner_company',
    'survey',
    'survey_response',
    'archive_series',
    'department_permission',
    'category_labels'
  )),
  record_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (record_type, record_id)
);

create index if not exists application_records_type_idx
  on public.application_records (record_type);
create index if not exists application_records_owner_idx
  on public.application_records (owner_id)
  where owner_id is not null;
create index if not exists application_records_response_email_idx
  on public.application_records (lower(payload ->> 'respondentEmail'))
  where record_type = 'survey_response';
create index if not exists application_records_response_department_idx
  on public.application_records ((payload ->> 'department'))
  where record_type = 'survey_response';

create or replace function public.set_application_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_profiles_set_updated_at on public.app_profiles;
create trigger app_profiles_set_updated_at
before update on public.app_profiles
for each row execute function public.set_application_updated_at();

drop trigger if exists application_records_set_updated_at on public.application_records;
create trigger application_records_set_updated_at
before update on public.application_records
for each row execute function public.set_application_updated_at();

create or replace function public.handle_application_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or lower(new.email) not like '%@mgenesis.com' then
    return new;
  end if;

  insert into public.app_profiles (email, user_id, role, designation, department)
  values (
    lower(new.email),
    new.id,
    case when lower(new.email) = 'admin@mgenesis.com' then 'Admin' else 'Employee' end,
    case when lower(new.email) = 'admin@mgenesis.com' then 'Executive' else 'Rank & File' end,
    case when lower(new.email) = 'admin@mgenesis.com' then 'Business Solutions Manager' else 'Logistics' end
  )
  on conflict (email) do update set user_id = excluded.user_id;
  return new;
end;
$$;

drop trigger if exists on_application_auth_user_created on auth.users;
create trigger on_application_auth_user_created
after insert or update of email on auth.users
for each row execute function public.handle_application_auth_user();

insert into public.app_profiles (email, user_id, role, designation, department)
select
  lower(email),
  id,
  case when lower(email) = 'admin@mgenesis.com' then 'Admin' else 'Employee' end,
  case when lower(email) = 'admin@mgenesis.com' then 'Executive' else 'Rank & File' end,
  case when lower(email) = 'admin@mgenesis.com' then 'Business Solutions Manager' else 'Logistics' end
from auth.users
where email is not null and lower(email) like '%@mgenesis.com'
on conflict (email) do update set user_id = excluded.user_id;

create or replace function public.my_app_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.my_app_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.app_profiles where email = public.my_app_email() limit 1
$$;

create or replace function public.my_app_designation()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select designation from public.app_profiles where email = public.my_app_email() limit 1
$$;

create or replace function public.my_app_department()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select department from public.app_profiles where email = public.my_app_email() limit 1
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.my_app_role() = 'Admin', false)
$$;

revoke all on function public.my_app_email() from public;
revoke all on function public.my_app_role() from public;
revoke all on function public.my_app_designation() from public;
revoke all on function public.my_app_department() from public;
revoke all on function public.is_app_admin() from public;
grant execute on function public.my_app_email() to authenticated;
grant execute on function public.my_app_role() to authenticated;
grant execute on function public.my_app_designation() to authenticated;
grant execute on function public.my_app_department() to authenticated;
grant execute on function public.is_app_admin() to authenticated;

alter table public.app_profiles enable row level security;
alter table public.application_records enable row level security;

grant select, insert, update, delete on public.app_profiles to authenticated;
grant select, insert, update, delete on public.application_records to authenticated;
revoke all on public.app_profiles from anon;
revoke all on public.application_records from anon;

create policy "app_profiles_select_own_or_admin"
  on public.app_profiles for select to authenticated
  using (email = public.my_app_email() or public.is_app_admin());

create policy "app_profiles_write_admin_only"
  on public.app_profiles for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin() and email like '%@mgenesis.com');

create policy "application_records_select_reference"
  on public.application_records for select to authenticated
  using (
    public.is_confirmed_mgenesis_user()
    and record_type in (
      'partner_company', 'survey', 'archive_series',
      'department_permission', 'category_labels'
    )
  );

create policy "application_records_select_responses_scoped"
  on public.application_records for select to authenticated
  using (
    record_type = 'survey_response'
    and public.is_confirmed_mgenesis_user()
    and (
      public.is_app_admin()
      or public.my_app_designation() in ('Managerial', 'Director', 'Executive')
      or (
        public.my_app_designation() = 'Supervisory'
        and payload ->> 'department' = public.my_app_department()
      )
      or owner_id = auth.uid()
      or lower(coalesce(payload ->> 'respondentEmail', '')) = public.my_app_email()
    )
  );

create policy "application_records_write_admin"
  on public.application_records for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "application_records_insert_own_response"
  on public.application_records for insert to authenticated
  with check (
    record_type = 'survey_response'
    and owner_id = auth.uid()
    and lower(coalesce(payload ->> 'respondentEmail', '')) = public.my_app_email()
  );

-- Seed the editable Partner Companies contract from the normalized import.
insert into public.application_records (record_type, record_id, payload)
select
  'partner_company',
  c.id::text,
  jsonb_strip_nulls(jsonb_build_object(
    'id', c.id::text,
    'name', c.canonical_name,
    'type', coalesce((
      select b.partner_type
      from public.company_branches b
      where b.company_id = c.id and b.partner_type is not null
      order by b.source_row_number
      limit 1
    ), 'Uncategorized'),
    'supplierOrigin', (
      select b.supplier_origin
      from public.company_branches b
      where b.company_id = c.id and b.supplier_origin is not null
      order by b.source_row_number
      limit 1
    ),
    'email', (
      select b.email
      from public.company_branches b
      where b.company_id = c.id and b.email is not null
      order by b.source_row_number
      limit 1
    ),
    'createdAt', c.created_at,
    'registeredAt', (
      select b.date_accredited
      from public.company_branches b
      where b.company_id = c.id and b.date_accredited is not null
      order by b.source_row_number
      limit 1
    ),
    'isArchived', false,
    'accreditationStatus', case when exists (
      select 1 from public.company_branches b
      where b.company_id = c.id and lower(coalesce(b.status, '')) = 'accredited'
    ) then 'Accredited' else 'Unaccredited' end,
    'branches', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', b.id::text,
        'bpCode', coalesce(b.bp_code, ''),
        'address', b.address,
        'federalTaxId', b.federal_tax_id,
        'industry', b.industry,
        'contactPerson', b.contact_person,
        'position', b.contact_position,
        'mobilePhone', b.mobile_phone,
        'email', b.email,
        'rawCategory', b.category_raw,
        'supplierRank', b.supplier_rank_raw,
        'dateAccredited', b.date_accredited,
        'status', b.status,
        'sourceRow', b.source_row_number,
        'documents', coalesce((
          select jsonb_object_agg(
            d.document_key,
            jsonb_strip_nulls(jsonb_build_object(
              'provided', coalesce(nullif(trim(d.raw_value), '') is not null or d.expiry_date is not null, false),
              'expiryDate', d.expiry_date,
              'status', d.status,
              'daysLeft', d.days_left
            ))
          )
          from public.company_documents d
          where d.branch_id = b.id
        ), '{}'::jsonb)
      )) order by b.source_row_number)
      from public.company_branches b
      where b.company_id = c.id
    ), '[]'::jsonb)
  ))
from public.companies c
on conflict (record_type, record_id) do nothing;

-- Seed imported evaluation answers into the frontend's current flat-row
-- contract. Imported rows have no auth owner; RLS exposes them by profile
-- scope and keeps them hidden from unrelated Rank & File users.
insert into public.application_records (record_type, record_id, payload, owner_id)
select
  'survey_response',
  s.id::text || ':' || coalesce(q.canonical_question_key, q.question_key),
  jsonb_strip_nulls(jsonb_build_object(
    'responseId', s.id::text,
    'surveyId', 'default-' || lower(s.form_code),
    'companyId', s.company_id::text,
    'surveyType', s.form_code,
    'respondentType', coalesce(s.respondent_designation, 'Imported'),
    'startTime', s.started_at_raw,
    'submissionDate', coalesce(s.submitted_at_raw, s.submitted_at::text),
    'company', c.canonical_name,
    'department', s.respondent_department,
    'address', s.company_address_raw,
    'questionId', coalesce(q.canonical_question_key, q.question_key),
    'questionNumber', q.display_order,
    'question', q.question_text,
    'questionCategory', q.category,
    'rating', case
      when a.answer_status = 'rated' then to_jsonb(a.rating_value)
      else to_jsonb('N/A'::text)
    end,
    'comment', case
      when a.answer_status = 'populated' then coalesce(a.text_value, '')
      else ''
    end,
    'respondentEmail', lower(nullif(trim(s.respondent_email_raw), '')),
    'archived', false
  )),
  u.id
from public.evaluation_answers a
join public.evaluation_submissions s on s.id = a.submission_id
join public.evaluation_questions q on q.id = a.question_id
join public.companies c on c.id = s.company_id
left join auth.users u on lower(u.email) = lower(s.respondent_email_raw)
on conflict (record_type, record_id) do nothing;
