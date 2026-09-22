-- Make Supabase the durable source for shared configuration, operational
-- history, and per-user state. Device-only drafts and layout preferences are
-- intentionally excluded.

alter table public.application_records
  drop constraint if exists application_records_record_type_check;

alter table public.application_records
  add constraint application_records_record_type_check check (record_type in (
    'partner_company',
    'survey',
    'survey_response',
    'archive_series',
    'department_permission',
    'category_labels',
    'feedback_contact',
    'feedback_report',
    'feedback_settings',
    'document_notification_rule',
    'notification_read_state',
    'admin_activity',
    'document_modification',
    'export_history',
    'supplier_ranking_history',
    'employee_notification_state',
    'reminder_settings',
    'compliance_snapshot'
  ));

-- Cloud projects can retain broad default privileges even after narrower
-- GRANT statements are added. Reset them before granting only the Data API
-- operations used by the application.
revoke all on table public.app_profiles from anon, authenticated;
revoke all on table public.application_records from anon, authenticated;
grant select, insert, update, delete on table public.app_profiles to authenticated;
grant select, insert, update, delete on table public.application_records to authenticated;

-- Trigger functions are invoked by PostgreSQL and are not public RPCs.
revoke all on function public.handle_application_auth_user() from public, anon, authenticated;

-- RLS helper functions are intentionally executable only by authenticated
-- sessions. They are not available to signed-out Data API clients.
revoke all on function public.my_app_email() from public, anon;
revoke all on function public.my_app_role() from public, anon;
revoke all on function public.my_app_designation() from public, anon;
revoke all on function public.my_app_department() from public, anon;
revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.my_app_email() to authenticated;
grant execute on function public.my_app_role() to authenticated;
grant execute on function public.my_app_designation() to authenticated;
grant execute on function public.my_app_department() to authenticated;
grant execute on function public.is_app_admin() to authenticated;

drop policy if exists "application_records_select_reference" on public.application_records;
create policy "application_records_select_reference"
  on public.application_records for select to authenticated
  using (
    public.is_confirmed_mgenesis_user()
    and record_type in (
      'partner_company', 'survey', 'archive_series',
      'department_permission', 'category_labels',
      'document_notification_rule', 'reminder_settings',
      'document_modification', 'compliance_snapshot'
    )
  );

drop policy if exists "application_records_select_responses_scoped" on public.application_records;
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
      or owner_id = (select auth.uid())
      or lower(coalesce(payload ->> 'respondentEmail', '')) = public.my_app_email()
    )
  );

drop policy if exists "application_records_insert_own_response" on public.application_records;
create policy "application_records_insert_own_response"
  on public.application_records for insert to authenticated
  with check (
    record_type = 'survey_response'
    and owner_id = (select auth.uid())
    and lower(coalesce(payload ->> 'respondentEmail', '')) = public.my_app_email()
  );

drop policy if exists "application_records_notification_state_own" on public.application_records;
create policy "application_records_notification_state_own"
  on public.application_records for all to authenticated
  using (
    record_type = 'notification_read_state'
    and owner_id = (select auth.uid())
    and record_id = (select auth.uid())::text
    and lower(coalesce(payload ->> 'userEmail', '')) = public.my_app_email()
  )
  with check (
    record_type = 'notification_read_state'
    and owner_id = (select auth.uid())
    and record_id = (select auth.uid())::text
    and lower(coalesce(payload ->> 'userEmail', '')) = public.my_app_email()
  );

create policy "application_records_user_state_own"
  on public.application_records for all to authenticated
  using (
    record_type in ('export_history', 'employee_notification_state')
    and owner_id = (select auth.uid())
  )
  with check (
    record_type in ('export_history', 'employee_notification_state')
    and owner_id = (select auth.uid())
  );

create policy "application_records_document_modification_insert_own"
  on public.application_records for insert to authenticated
  with check (
    record_type = 'document_modification'
    and owner_id = (select auth.uid())
    and lower(coalesce(payload ->> 'actorEmail', '')) = public.my_app_email()
  );

create policy "application_records_admin_history_select"
  on public.application_records for select to authenticated
  using (
    public.is_app_admin()
    and record_type in ('admin_activity', 'supplier_ranking_history')
  );

-- Admin writes continue to be covered by application_records_write_admin.
-- Add only the canonical tables to Realtime; clients refetch through RLS
-- rather than trusting event payloads as application data.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'application_records'
  ) then
    execute 'alter publication supabase_realtime add table public.application_records';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.app_profiles';
  end if;
end;
$$;
