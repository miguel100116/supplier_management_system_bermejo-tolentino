-- Avoid repeated profile/helper evaluation for every visible response row.
-- Scalar subqueries let Postgres evaluate stable authorization helpers once
-- per statement while preserving the existing authorization conditions.
create index if not exists application_records_response_department_order_idx
  on public.application_records ((payload ->> 'department'), record_id)
  where record_type = 'survey_response';

create index if not exists application_records_response_email_order_idx
  on public.application_records ((lower(coalesce(payload ->> 'respondentEmail', ''))), record_id)
  where record_type = 'survey_response';

create index if not exists application_records_response_owner_order_idx
  on public.application_records (owner_id, record_id)
  where record_type = 'survey_response' and owner_id is not null;

drop policy if exists "application_records_select" on public.application_records;

create policy "application_records_select"
  on public.application_records for select to authenticated
  using (
    (select public.is_confirmed_mgenesis_user())
    and (
      (select private.is_app_admin())
      or record_type in (
        'partner_company', 'survey', 'archive_series',
        'department_permission', 'category_labels',
        'document_notification_rule', 'reminder_settings',
        'document_modification', 'compliance_snapshot'
      )
      or (
        record_type = 'survey_response'
        and (
          (select private.my_app_designation()) in ('Managerial', 'Director', 'Executive')
          or (
            (select private.my_app_designation()) = 'Supervisory'
            and payload ->> 'department' = (select private.my_app_department())
          )
          or owner_id = (select auth.uid())
          or lower(coalesce(payload ->> 'respondentEmail', '')) = (select private.my_app_email())
        )
      )
      or (
        record_type in ('feedback_contact', 'feedback_report', 'feedback_settings')
        and (select private.my_app_designation()) in ('Supervisory', 'Managerial', 'Director', 'Executive')
      )
      or (
        record_type = 'notification_read_state'
        and owner_id = (select auth.uid())
        and record_id = (select auth.uid())::text
        and lower(coalesce(payload ->> 'userEmail', '')) = (select private.my_app_email())
      )
      or (
        record_type in ('export_history', 'employee_notification_state')
        and owner_id = (select auth.uid())
      )
    )
  );
