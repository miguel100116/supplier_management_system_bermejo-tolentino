-- Company comparison in both directions against the four reviewed CSV imports.
-- READ ONLY. No deletion, restoration, file removal, or schema change occurs.
-- Run the complete statement in the application's actual Supabase project.
-- Requires the versioned normalized tables and their reviewed source hashes.
-- Expected baseline: 4 source files, 1140 companies, 280 evaluations.
-- Do not apply cleanup from these candidates until those counts and the target
-- project are verified. A name/ID difference may be a duplicate or spelling edit.

WITH expected_hashes(sha256) AS (
  VALUES
    ('82e2c6c10ec516dc52f7680f49c467276c7ed98f58b67b9d488075178a085eaa'),
    ('402ee678934ba6ea71299a817bfa5a7e93969563b246273c83d05e7b35b93212'),
    ('3df87c2d987c8f0b0792a40e57b10803dec1926f0a7327a971bf69c6a56b646b'),
    ('b01101f4330f344005002879b2c975c8d5d8f538db174f26de14a9371187f29b')
), source_files AS (
  SELECT f.id FROM public.import_source_files f
  JOIN expected_hashes h ON h.sha256 = f.sha256
), baseline_company_ids AS (
  SELECT b.company_id
  FROM public.company_branches b JOIN source_files f ON f.id = b.source_file_id
  UNION
  SELECT s.company_id
  FROM public.evaluation_submissions s JOIN source_files f ON f.id = s.source_file_id
), baseline_companies AS (
  SELECT c.id::text AS company_id, c.canonical_name AS company
  FROM public.companies c JOIN baseline_company_ids b ON b.company_id = c.id
), baseline_names AS (
  SELECT b.company_id,
    LOWER(REGEXP_REPLACE(TRIM(b.company), '[[:space:]]+', ' ', 'g')) AS name_key
  FROM baseline_companies b
  UNION
  SELECT b.company_id,
    LOWER(REGEXP_REPLACE(TRIM(a.source_name), '[[:space:]]+', ' ', 'g'))
  FROM public.company_aliases a
  JOIN baseline_companies b ON b.company_id = a.company_id::text
), app_companies AS (
  SELECT ar.record_id, ar.payload->>'name' AS company,
    LOWER(REGEXP_REPLACE(TRIM(COALESCE(ar.payload->>'name','')),
      '[[:space:]]+', ' ', 'g')) AS name_key
  FROM public.application_records ar WHERE ar.record_type = 'partner_company'
), findings AS (
  SELECT 'system_company_outside_csv'::text AS difference,
    a.record_id AS system_record_id, NULL::text AS csv_company_id,
    a.company AS system_company, NULL::text AS csv_company
  FROM app_companies a
  WHERE NOT EXISTS (SELECT 1 FROM baseline_companies b WHERE b.company_id = a.record_id)
    AND NOT EXISTS (SELECT 1 FROM baseline_names n WHERE n.name_key = a.name_key)
  UNION ALL
  SELECT 'csv_company_missing_from_system', NULL, b.company_id, NULL, b.company
  FROM baseline_companies b
  WHERE NOT EXISTS (SELECT 1 FROM app_companies a WHERE a.record_id = b.company_id)
    AND NOT EXISTS (
      SELECT 1 FROM app_companies a JOIN baseline_names n ON n.name_key = a.name_key
      WHERE n.company_id = b.company_id
    )
  UNION ALL
  SELECT 'matching_csv_id_but_different_name_review', a.record_id, b.company_id,
    a.company, b.company
  FROM app_companies a JOIN baseline_companies b ON b.company_id = a.record_id
  WHERE NOT EXISTS (
    SELECT 1 FROM baseline_names n
    WHERE n.company_id = b.company_id AND n.name_key = a.name_key
  )
  UNION ALL
  SELECT 'matching_csv_name_but_different_id_review', a.record_id, b.company_id,
    a.company, b.company
  FROM app_companies a JOIN baseline_names n ON n.name_key = a.name_key
  JOIN baseline_companies b ON b.company_id = n.company_id
  WHERE a.record_id <> b.company_id
), totals AS (
  SELECT (SELECT COUNT(*) FROM source_files) AS csv_source_files,
    (SELECT COUNT(*) FROM baseline_companies) AS csv_companies,
    (SELECT COUNT(*) FROM public.evaluation_submissions s
      JOIN source_files f ON f.id = s.source_file_id) AS csv_evaluations,
    (SELECT COUNT(*) FROM app_companies) AS system_companies
)
SELECT 'baseline_summary'::text AS difference, NULL::text AS system_record_id,
  NULL::text AS csv_company_id, NULL::text AS system_company,
  NULL::text AS csv_company, t.* FROM totals t
UNION ALL
SELECT f.*, t.* FROM findings f CROSS JOIN totals t
ORDER BY difference, system_company, csv_company;
