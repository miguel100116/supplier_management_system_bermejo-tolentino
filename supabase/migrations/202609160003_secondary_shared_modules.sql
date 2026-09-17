-- Shared persistence for the remaining multi-user business configuration.
-- Device-only drafts, widget layouts, and temporary selections are excluded.

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
    'document_notification_rule'
  ));

drop policy if exists "application_records_select_reference" on public.application_records;
create policy "application_records_select_reference"
  on public.application_records for select to authenticated
  using (
    public.is_confirmed_mgenesis_user()
    and record_type in (
      'partner_company', 'survey', 'archive_series',
      'department_permission', 'category_labels',
      'document_notification_rule'
    )
  );

create policy "application_records_select_feedback"
  on public.application_records for select to authenticated
  using (
    public.is_confirmed_mgenesis_user()
    and record_type in ('feedback_contact', 'feedback_report', 'feedback_settings')
    and (
      public.is_app_admin()
      or public.my_app_designation() in ('Supervisory', 'Managerial', 'Director', 'Executive')
    )
  );

create policy "application_records_write_feedback"
  on public.application_records for all to authenticated
  using (
    record_type in ('feedback_contact', 'feedback_report', 'feedback_settings')
    and (
      public.is_app_admin()
      or public.my_app_designation() in ('Supervisory', 'Managerial', 'Director', 'Executive')
    )
  )
  with check (
    record_type in ('feedback_contact', 'feedback_report', 'feedback_settings')
    and public.is_confirmed_mgenesis_user()
    and (
      public.is_app_admin()
      or public.my_app_designation() in ('Supervisory', 'Managerial', 'Director', 'Executive')
    )
  );
