-- Staging browser access for the first Supabase-backed application slice.
--
-- Supabase email/password authentication replaces the unavailable Azure
-- integration. Only confirmed, authenticated @mgenesis.com identities may
-- read the non-respondent reference data used by the Partner Companies and
-- survey-form screens. Raw evaluators, submissions, answers, aliases, and
-- import provenance remain inaccessible to browser roles.

create or replace function public.is_confirmed_mgenesis_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    auth.role() = 'authenticated'
    and lower(coalesce(auth.jwt() ->> 'email', '')) like '%@mgenesis.com'
$$;

revoke all on function public.is_confirmed_mgenesis_user() from public;
grant execute on function public.is_confirmed_mgenesis_user() to authenticated;

grant usage on schema public to authenticated;
grant select on public.companies to authenticated;
grant select on public.company_branches to authenticated;
grant select on public.company_documents to authenticated;
grant select on public.evaluation_forms to authenticated;
grant select on public.evaluation_questions to authenticated;

create policy "companies_select_confirmed_company_users"
  on public.companies
  for select
  to authenticated
  using (public.is_confirmed_mgenesis_user());

create policy "company_branches_select_confirmed_company_users"
  on public.company_branches
  for select
  to authenticated
  using (public.is_confirmed_mgenesis_user());

create policy "company_documents_select_confirmed_company_users"
  on public.company_documents
  for select
  to authenticated
  using (public.is_confirmed_mgenesis_user());

create policy "evaluation_forms_select_confirmed_company_users"
  on public.evaluation_forms
  for select
  to authenticated
  using (public.is_confirmed_mgenesis_user());

create policy "evaluation_questions_select_confirmed_company_users"
  on public.evaluation_questions
  for select
  to authenticated
  using (public.is_confirmed_mgenesis_user());
