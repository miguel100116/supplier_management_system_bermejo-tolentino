-- Store original Microsoft Forms evaluation exports in a private bucket.
-- Both object access and archive metadata are limited to authenticated Admins.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evaluation-import-archives',
  'evaluation-import-archives',
  false,
  26214400,
  array[
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "evaluation_import_archives_admin_select" on storage.objects;
drop policy if exists "evaluation_import_archives_admin_insert" on storage.objects;
drop policy if exists "evaluation_import_archives_admin_delete" on storage.objects;

create policy "evaluation_import_archives_admin_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evaluation-import-archives'
    and private.is_app_admin()
  );

create policy "evaluation_import_archives_admin_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evaluation-import-archives'
    and private.is_app_admin()
  );

create policy "evaluation_import_archives_admin_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'evaluation-import-archives'
    and private.is_app_admin()
  );

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
    'compliance_snapshot',
    'active_company_snapshot',
    'evaluation_import_archive'
  ));
