-- Keep authorization helpers out of the exposed public Data API schema, then
-- consolidate permissive policies so each table has one policy per operation.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.my_app_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function private.my_app_role()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select role
  from public.app_profiles
  where email = private.my_app_email()
  limit 1
$$;

create or replace function private.my_app_designation()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select designation
  from public.app_profiles
  where email = private.my_app_email()
  limit 1
$$;

create or replace function private.my_app_department()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select department
  from public.app_profiles
  where email = private.my_app_email()
  limit 1
$$;

create or replace function private.is_app_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(private.my_app_role() = 'Admin', false)
$$;

revoke all on function private.my_app_email() from public, anon;
revoke all on function private.my_app_role() from public, anon;
revoke all on function private.my_app_designation() from public, anon;
revoke all on function private.my_app_department() from public, anon;
revoke all on function private.is_app_admin() from public, anon;
grant execute on function private.my_app_email() to authenticated;
grant execute on function private.my_app_role() to authenticated;
grant execute on function private.my_app_designation() to authenticated;
grant execute on function private.my_app_department() to authenticated;
grant execute on function private.is_app_admin() to authenticated;

drop policy if exists "app_profiles_select_own_or_admin" on public.app_profiles;
drop policy if exists "app_profiles_write_admin_only" on public.app_profiles;

create policy "app_profiles_select"
  on public.app_profiles for select to authenticated
  using (email = private.my_app_email() or private.is_app_admin());

create policy "app_profiles_insert_admin"
  on public.app_profiles for insert to authenticated
  with check (private.is_app_admin() and email like '%@mgenesis.com');

create policy "app_profiles_update_admin"
  on public.app_profiles for update to authenticated
  using (private.is_app_admin())
  with check (private.is_app_admin() and email like '%@mgenesis.com');

create policy "app_profiles_delete_admin"
  on public.app_profiles for delete to authenticated
  using (private.is_app_admin());

drop policy if exists "application_records_select_reference" on public.application_records;
drop policy if exists "application_records_select_responses_scoped" on public.application_records;
drop policy if exists "application_records_write_admin" on public.application_records;
drop policy if exists "application_records_insert_own_response" on public.application_records;
drop policy if exists "application_records_select_feedback" on public.application_records;
drop policy if exists "application_records_write_feedback" on public.application_records;
drop policy if exists "application_records_notification_state_own" on public.application_records;
drop policy if exists "application_records_user_state_own" on public.application_records;
drop policy if exists "application_records_document_modification_insert_own" on public.application_records;
drop policy if exists "application_records_admin_history_select" on public.application_records;

create policy "application_records_select"
  on public.application_records for select to authenticated
  using (
    public.is_confirmed_mgenesis_user()
    and (
      private.is_app_admin()
      or record_type in (
        'partner_company', 'survey', 'archive_series',
        'department_permission', 'category_labels',
        'document_notification_rule', 'reminder_settings',
        'document_modification', 'compliance_snapshot'
      )
      or (
        record_type = 'survey_response'
        and (
          private.my_app_designation() in ('Managerial', 'Director', 'Executive')
          or (
            private.my_app_designation() = 'Supervisory'
            and payload ->> 'department' = private.my_app_department()
          )
          or owner_id = (select auth.uid())
          or lower(coalesce(payload ->> 'respondentEmail', '')) = private.my_app_email()
        )
      )
      or (
        record_type in ('feedback_contact', 'feedback_report', 'feedback_settings')
        and private.my_app_designation() in ('Supervisory', 'Managerial', 'Director', 'Executive')
      )
      or (
        record_type = 'notification_read_state'
        and owner_id = (select auth.uid())
        and record_id = (select auth.uid())::text
        and lower(coalesce(payload ->> 'userEmail', '')) = private.my_app_email()
      )
      or (
        record_type in ('export_history', 'employee_notification_state')
        and owner_id = (select auth.uid())
      )
    )
  );

create policy "application_records_insert"
  on public.application_records for insert to authenticated
  with check (
    public.is_confirmed_mgenesis_user()
    and (
      private.is_app_admin()
      or (
        record_type in ('feedback_contact', 'feedback_report', 'feedback_settings')
        and private.my_app_designation() in ('Supervisory', 'Managerial', 'Director', 'Executive')
      )
      or (
        record_type = 'survey_response'
        and owner_id = (select auth.uid())
        and lower(coalesce(payload ->> 'respondentEmail', '')) = private.my_app_email()
      )
      or (
        record_type = 'notification_read_state'
        and owner_id = (select auth.uid())
        and record_id = (select auth.uid())::text
        and lower(coalesce(payload ->> 'userEmail', '')) = private.my_app_email()
      )
      or (
        record_type in ('export_history', 'employee_notification_state')
        and owner_id = (select auth.uid())
      )
      or (
        record_type = 'document_modification'
        and owner_id = (select auth.uid())
        and lower(coalesce(payload ->> 'actorEmail', '')) = private.my_app_email()
      )
    )
  );

create policy "application_records_update"
  on public.application_records for update to authenticated
  using (
    private.is_app_admin()
    or (
      record_type in ('feedback_contact', 'feedback_report', 'feedback_settings')
      and private.my_app_designation() in ('Supervisory', 'Managerial', 'Director', 'Executive')
    )
    or (
      record_type = 'notification_read_state'
      and owner_id = (select auth.uid())
      and record_id = (select auth.uid())::text
    )
    or (
      record_type in ('export_history', 'employee_notification_state')
      and owner_id = (select auth.uid())
    )
  )
  with check (
    private.is_app_admin()
    or (
      record_type in ('feedback_contact', 'feedback_report', 'feedback_settings')
      and private.my_app_designation() in ('Supervisory', 'Managerial', 'Director', 'Executive')
    )
    or (
      record_type = 'notification_read_state'
      and owner_id = (select auth.uid())
      and record_id = (select auth.uid())::text
      and lower(coalesce(payload ->> 'userEmail', '')) = private.my_app_email()
    )
    or (
      record_type in ('export_history', 'employee_notification_state')
      and owner_id = (select auth.uid())
    )
  );

create policy "application_records_delete"
  on public.application_records for delete to authenticated
  using (
    private.is_app_admin()
    or (
      record_type in ('feedback_contact', 'feedback_report', 'feedback_settings')
      and private.my_app_designation() in ('Supervisory', 'Managerial', 'Director', 'Executive')
    )
    or (
      record_type = 'notification_read_state'
      and owner_id = (select auth.uid())
      and record_id = (select auth.uid())::text
    )
    or (
      record_type in ('export_history', 'employee_notification_state')
      and owner_id = (select auth.uid())
    )
  );

drop function if exists public.is_app_admin();
drop function if exists public.my_app_department();
drop function if exists public.my_app_designation();
drop function if exists public.my_app_role();
drop function if exists public.my_app_email();
