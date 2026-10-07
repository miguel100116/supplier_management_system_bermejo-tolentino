-- Read-only inventory for the repository CSV data audit (2026-10-02).
-- Run in the application's actual Supabase project. All statements are SELECTs.
-- Results identify review candidates, not records approved for deletion.
-- This does not inspect Supabase Storage files or browser caches.

-- 1. Inventory every independently persisted application collection.
SELECT record_type, COUNT(*) AS stored_rows
FROM public.application_records
GROUP BY record_type
ORDER BY record_type;

-- 2. Confirm normalized source files match the reviewed repository digests.
SELECT sha256, COUNT(*) AS source_records
FROM public.import_source_files
GROUP BY sha256
ORDER BY sha256;
-- Master: 82e2c6c10ec516dc52f7680f49c467276c7ed98f58b67b9d488075178a085eaa
-- Courier: 402ee678934ba6ea71299a817bfa5a7e93969563b246273c83d05e7b35b93212
-- Subcontractor: 3df87c2d987c8f0b0792a40e57b10803dec1926f0a7327a971bf69c6a56b646b
-- Supplier: b01101f4330f344005002879b2c975c8d5d8f538db174f26de14a9371187f29b

-- 3. Exact baseline evaluation presence. Expected: Courier30, Subcontractor65,
-- Supplier185; missing evaluations0. Presence does not establish content equality.
WITH baseline AS (
  SELECT s.id::text AS response_id, s.form_code
  FROM public.evaluation_submissions s
  JOIN public.import_source_files f ON f.id = s.source_file_id
  WHERE f.sha256 IN (
    '402ee678934ba6ea71299a817bfa5a7e93969563b246273c83d05e7b35b93212',
    '3df87c2d987c8f0b0792a40e57b10803dec1926f0a7327a971bf69c6a56b646b',
    'b01101f4330f344005002879b2c975c8d5d8f538db174f26de14a9371187f29b'
  )
)
SELECT b.form_code AS survey_type, COUNT(*) AS csv_evaluations,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM public.application_records ar
    WHERE ar.record_type = 'survey_response'
      AND ar.payload->>'responseId' = b.response_id
  )) AS present_in_application,
  COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM public.application_records ar
    WHERE ar.record_type = 'survey_response'
      AND ar.payload->>'responseId' = b.response_id
  )) AS missing_evaluations
FROM baseline b GROUP BY b.form_code ORDER BY b.form_code;

-- 4. Responses outside exact normalized baseline IDs, grouped for review.
-- A legitimate browser re-import uses IMPORT-* IDs, so unmatched is not proof
-- of dummy content. Verify source hash and answer content before classifying.
WITH baseline AS (
  SELECT s.id::text AS response_id
  FROM public.evaluation_submissions s
  JOIN public.import_source_files f ON f.id = s.source_file_id
  WHERE f.sha256 IN (
    '402ee678934ba6ea71299a817bfa5a7e93969563b246273c83d05e7b35b93212',
    '3df87c2d987c8f0b0792a40e57b10803dec1926f0a7327a971bf69c6a56b646b',
    'b01101f4330f344005002879b2c975c8d5d8f538db174f26de14a9371187f29b'
  )
)
SELECT ar.payload->>'company' AS company,
  ar.payload->>'surveyType' AS survey_type,
  ar.payload->>'dataSource' AS data_source,
  ar.payload->>'importBatchId' AS import_batch_id,
  COUNT(DISTINCT ar.payload->>'responseId') AS evaluations,
  COUNT(*) AS answer_rows,
  COUNT(*) FILTER (WHERE NULLIF(TRIM(ar.payload->>'responseId'), '') IS NULL)
    AS rows_without_response_id
FROM public.application_records ar
WHERE ar.record_type = 'survey_response'
  AND NOT EXISTS (SELECT 1 FROM baseline b
    WHERE b.response_id = ar.payload->>'responseId')
GROUP BY 1,2,3,4 ORDER BY 2,1;

-- 5. Baseline answer presence and mutable answer values against original seed
-- mapping. Expected baseline answers6355. Differences require reviewing later
-- edits/migrations; they are not automatically dummy data. No answer text is output.
WITH expected AS (
  SELECT s.form_code, s.id::text AS response_id,
    COALESCE(q.canonical_question_key, q.question_key) AS question_id,
    c.canonical_name AS company,
    CASE WHEN a.answer_status = 'rated' THEN TO_JSONB(a.rating_value)
      ELSE TO_JSONB('N/A'::text) END AS rating,
    CASE WHEN a.answer_status = 'populated' THEN COALESCE(a.text_value, '')
      ELSE '' END AS comment
  FROM public.evaluation_answers a
  JOIN public.evaluation_submissions s ON s.id = a.submission_id
  JOIN public.import_source_files f ON f.id = s.source_file_id
  JOIN public.evaluation_questions q ON q.id = a.question_id
  JOIN public.companies c ON c.id = s.company_id
  WHERE f.sha256 IN (
    '402ee678934ba6ea71299a817bfa5a7e93969563b246273c83d05e7b35b93212',
    '3df87c2d987c8f0b0792a40e57b10803dec1926f0a7327a971bf69c6a56b646b',
    'b01101f4330f344005002879b2c975c8d5d8f538db174f26de14a9371187f29b'
  )
)
SELECT e.form_code AS survey_type, COUNT(*) AS baseline_answers,
  COUNT(*) FILTER (WHERE ar.record_id IS NULL) AS missing_answer_rows,
  COUNT(*) FILTER (WHERE ar.record_id IS NOT NULL AND (
    ar.payload->>'responseId' IS DISTINCT FROM e.response_id OR
    ar.payload->>'questionId' IS DISTINCT FROM e.question_id OR
    ar.payload->>'company' IS DISTINCT FROM e.company OR
    ar.payload->'rating' IS DISTINCT FROM e.rating OR
    COALESCE(ar.payload->>'comment', '') IS DISTINCT FROM e.comment
  )) AS rows_differing_from_seed_mapping
FROM expected e
LEFT JOIN public.application_records ar ON ar.record_type = 'survey_response'
  AND ar.record_id = e.response_id || ':' || e.question_id
GROUP BY e.form_code ORDER BY e.form_code;

-- 6. Known historical sample reports (local getter hides these IDs).
SELECT record_type, record_id, payload->>'surveyTitle' AS survey_title,
  payload->>'companyName' AS company
FROM public.application_records
WHERE record_type = 'feedback_report'
  AND record_id IN ('rpt-queued-001','rpt-sent-002','rpt-returned-003');

-- 7. Test-looking form titles only: review candidates, not a deletion predicate.
SELECT record_id, payload->>'title' AS title, payload->>'archived' AS archived
FROM public.application_records
WHERE record_type = 'survey'
  AND COALESCE(payload->>'title','') ~* '^tests?($|[[:space:]._-]|[0-9])'
ORDER BY record_id;

-- 8. Top-level references to the four previously removed forms.
-- Nested snapshots/body/history may also hold references; this is not exhaustive.
SELECT record_type, record_id
FROM public.application_records
WHERE payload->>'surveyId' IN (
    'survey-1790126058807','survey-1789958877889',
    'survey-1789958339611','survey-1789958645414'
  ) OR payload->>'archivedBySurveyId' IN (
    'survey-1790126058807','survey-1789958877889',
    'survey-1789958339611','survey-1789958645414'
  )
ORDER BY record_type, record_id;

-- 9. Sources whose contents require separate review. No Storage files are changed.
SELECT record_type, record_id, payload->>'surveyType' AS survey_type,
  payload->>'sourceFileName' AS source_file, payload->>'uploadedAt' AS uploaded_at
FROM public.application_records
WHERE record_type IN ('active_company_snapshot','evaluation_import_archive')
ORDER BY record_type, uploaded_at DESC;

-- 10. Missing email/department can activate synthetic notification defaults.
SELECT payload->>'surveyType' AS survey_type,
  COUNT(*) FILTER (WHERE NULLIF(TRIM(payload->>'respondentEmail'),'') IS NULL)
    AS answer_rows_without_email,
  COUNT(*) FILTER (WHERE NULLIF(TRIM(payload->>'department'),'') IS NULL)
    AS answer_rows_without_department
FROM public.application_records
WHERE record_type = 'survey_response'
GROUP BY 1 ORDER BY 1;
