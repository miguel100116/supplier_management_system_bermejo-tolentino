-- Read-only readiness and reconciliation for 202609220001_response_provenance.
-- This file intentionally contains no INSERT, UPDATE, DELETE, DDL, or RPC call.

with normalized_answers as (
  select
    s.id::text as response_id,
    coalesce(q.canonical_question_key, q.question_key) as question_id,
    s.form_code,
    'client-csv:' || lower(s.form_code) || ':' || f.sha256 as expected_batch_id
  from public.evaluation_answers a
  join public.evaluation_submissions s on s.id = a.submission_id
  join public.evaluation_questions q on q.id = a.question_id
  join public.import_source_files f on f.id = s.source_file_id
),
classified as (
  select
    n.form_code,
    n.response_id,
    n.question_id,
    n.expected_batch_id,
    ar.record_id,
    ar.payload ->> 'dataSource' as data_source,
    ar.payload ->> 'importBatchId' as import_batch_id
  from normalized_answers n
  left join public.application_records ar
    on ar.record_type = 'survey_response'
   and ar.record_id = n.response_id || ':' || n.question_id
   and ar.payload ->> 'responseId' = n.response_id
   and ar.payload ->> 'questionId' = n.question_id
)
select
  form_code,
  count(*) as normalized_answers,
  count(*) filter (where record_id is not null) as exact_application_rows,
  count(*) filter (where record_id is null) as missing_application_rows,
  count(*) filter (where record_id is not null and data_source is null) as pending_rows,
  count(*) filter (
    where data_source = 'client_csv' and import_batch_id = expected_batch_id
  ) as exact_provenance_rows,
  count(*) filter (
    where data_source is not null
      and not (data_source = 'client_csv' and import_batch_id = expected_batch_id)
  ) as protected_nonmatching_rows
from classified
group by grouping sets ((form_code), ())
order by form_code nulls last;

-- Before execution, approval requires:
--   normalized_answers = exact_application_rows = pending_rows = 6,355
--   missing_application_rows = protected_nonmatching_rows = 0
--   exact_provenance_rows is 0 while the migration remains unapplied
-- After execution, approval requires:
--   normalized_answers = exact_application_rows = exact_provenance_rows = 6,355
--   missing_application_rows = pending_rows = protected_nonmatching_rows = 0
