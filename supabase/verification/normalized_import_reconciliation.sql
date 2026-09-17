-- One-row reconciliation summary for CLI verification after normalized import.
-- Read-only: this file does not create, update, or delete anything.

select
  (select count(*) from public.import_source_files) as source_files,
  (select count(*) from public.companies) as companies,
  (select count(*) from public.company_branches) as company_branches,
  (select count(*) from public.company_documents) as company_documents,
  (select count(*) from public.evaluation_forms) as evaluation_forms,
  (select count(*) from public.evaluation_questions) as evaluation_questions,
  (select count(*) from public.evaluators) as evaluators,
  (select count(*) from public.company_aliases) as company_aliases,
  (select count(*) from public.evaluation_submissions) as evaluation_submissions,
  (select count(*) from public.evaluation_answers) as evaluation_answers,
  (
    select jsonb_object_agg(form_code, row_count order by form_code)
    from (
      select form_code, count(*) as row_count
      from public.evaluation_submissions
      group by form_code
    ) counts
  ) as submissions_by_form,
  (
    select jsonb_object_agg(answer_status, row_count order by answer_status)
    from (
      select answer_status, count(*) as row_count
      from public.evaluation_answers
      group by answer_status
    ) counts
  ) as answers_by_status,
  (
    select count(*)
    from (
      select bp_code
      from public.company_branches
      where bp_code is not null
      group by bp_code
      having count(*) > 1
    ) duplicates
  ) as duplicate_bp_codes,
  (
    select count(*)
    from (
      select source_file_id, source_record_id
      from public.evaluation_submissions
      group by source_file_id, source_record_id
      having count(*) > 1
    ) duplicates
  ) as duplicate_submissions,
  (
    select count(*)
    from (
      select submission_id, question_id
      from public.evaluation_answers
      group by submission_id, question_id
      having count(*) > 1
    ) duplicates
  ) as duplicate_answers,
  (
    select count(*)
    from public.company_branches b
    left join public.companies c on c.id = b.company_id
    where c.id is null
  ) as branches_without_company,
  (
    select count(*)
    from public.evaluation_submissions s
    left join public.companies c on c.id = s.company_id
    where c.id is null
  ) as submissions_without_company,
  (
    select count(*)
    from public.evaluation_answers a
    left join public.evaluation_submissions s on s.id = a.submission_id
    left join public.evaluation_questions q on q.id = a.question_id
    where s.id is null or q.id is null
  ) as answers_without_submission_or_question;
