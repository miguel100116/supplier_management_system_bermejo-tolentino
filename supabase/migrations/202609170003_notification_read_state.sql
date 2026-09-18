-- Persist each authenticated user's notification read/unread choices so the
-- badge does not reset when the browser session is recreated. Notification
-- content remains derived from canonical response and document records; only
-- the per-user read IDs are stored here.

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
    'notification_read_state'
  ));

drop policy if exists "application_records_notification_state_own" on public.application_records;
create policy "application_records_notification_state_own"
  on public.application_records for all to authenticated
  using (
    record_type = 'notification_read_state'
    and owner_id = auth.uid()
    and record_id = auth.uid()::text
    and lower(coalesce(payload ->> 'userEmail', '')) = public.my_app_email()
  )
  with check (
    record_type = 'notification_read_state'
    and owner_id = auth.uid()
    and record_id = auth.uid()::text
    and lower(coalesce(payload ->> 'userEmail', '')) = public.my_app_email()
  );
