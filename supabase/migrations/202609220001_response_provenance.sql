-- Add non-destructive provenance metadata to the client CSV evaluations that
-- were seeded into the JSON application store by 202609160002. Live/test
-- submissions are not rewritten here because their intent must not be guessed.
update public.application_records ar
set payload = ar.payload
  || jsonb_build_object(
    'dataSource', 'client_csv',
    'importBatchId', 'client-csv:' || lower(s.form_code) || ':' || f.sha256
  )
from public.evaluation_submissions s
join public.import_source_files f on f.id = s.source_file_id
where ar.record_type = 'survey_response'
  and ar.payload ->> 'responseId' = s.id::text
  and ar.payload ->> 'dataSource' is null;
