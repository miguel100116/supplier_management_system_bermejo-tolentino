-- Versioned active-company lists used by the Admin-only Company Leaderboards
-- modal. Each application record is an immutable upload snapshot for one
-- partner type. Existing application-record RLS already limits all record
-- types not explicitly shared to administrators.

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
    'active_company_snapshot'
  ));

insert into public.application_records (record_type, record_id, payload)
values
  (
    'active_company_snapshot',
    'courier-repository-seed-2026-09-23',
    jsonb_build_object(
      'id', 'courier-repository-seed-2026-09-23',
      'surveyType', 'Courier',
      'uploadedAt', '2026-09-23T00:00:00.000Z',
      'uploadedBy', 'repository-seed',
      'sourceFileName', 'Microgenesis Courier Evaluation Form.csv',
      'companies', to_jsonb(array[
        'Airspeed International Corp',
        'Alphacon Logistics International Corp',
        'Cloverxpress Freight Inc',
        'Lite Xpress International Inc',
        'Road2go Trucking Services OPC',
        'RZ1 Freight Express Corporation',
        'Yello X Supply Chain Solutions'
      ]::text[])
    )
  ),
  (
    'active_company_snapshot',
    'supplier-repository-seed-2026-09-23',
    jsonb_build_object(
      'id', 'supplier-repository-seed-2026-09-23',
      'surveyType', 'Supplier',
      'uploadedAt', '2026-09-23T00:00:00.000Z',
      'uploadedBy', 'repository-seed',
      'sourceFileName', 'Microgenesis Supplier Evaluation Form.csv',
      'companies', to_jsonb(array[
        'ACW Distribution (Phils), Inc',
        'AptSecure Technologies Inc',
        'Apuma, March Maanap',
        'Ardent Networks Inc',
        'Banbros Commercial, Incorporated',
        'Bridge Distribution, Inc',
        'Exclusive Networks-Ph Inc',
        'M-Security Tech Philippines, Inc',
        'Mec Computer Corporation',
        'PAX8 Philippines Inc',
        'Sencolink Technologies Inc',
        'Softwareone Philippines Corporation',
        'Streamline Works Inc',
        'Touchstream Digital, Inc',
        'Versatech International Inc',
        'VSTECS Phils. Inc',
        'Westcon Group Philippines',
        'Westcon Solutions Philippines Inc',
        'Wordtext Systems, Inc',
        'Wyntech Corp'
      ]::text[])
    )
  ),
  (
    'active_company_snapshot',
    'subcontractor-repository-seed-2026-09-23',
    jsonb_build_object(
      'id', 'subcontractor-repository-seed-2026-09-23',
      'surveyType', 'Subcontractor',
      'uploadedAt', '2026-09-23T00:00:00.000Z',
      'uploadedBy', 'repository-seed',
      'sourceFileName', 'Microgenesis Subcontractor Evaluation Form.csv',
      'companies', to_jsonb(array[
        'Alvarez, Greg Yap',
        'Cara Electrical and Network Solutions Inc',
        'Datalec Technology Corporation',
        'Glimpse-DC Electronics Industries Inc',
        'J & C Obenita Construction OPC',
        'MTeknik Technologies Solutions, Inc',
        'Pagpaguitan, Andy Lamberte',
        'Paragon Electromech Development Corporation',
        'Polinar, Lucilo Dispo',
        'Skyconvergence Inc',
        'Techvision ICT Solutions, Inc',
        'Unikkon Network Philippines Inc',
        'ZIMOSystem Solutions Inc'
      ]::text[])
    )
  )
on conflict (record_type, record_id) do nothing;
