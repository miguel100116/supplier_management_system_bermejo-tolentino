-- Read-only verification queries for the normalized CSV import.
-- Run only after 202609150001_normalized_business_data.sql and the importer.

select source_key, file_name, source_record_count, sha256
from public.import_source_files
order by source_key;

select
  (select count(*) from public.companies) as companies,
  (select count(*) from public.company_branches) as company_branches,
  (select count(*) from public.company_documents) as company_documents,
  (select count(*) from public.evaluators) as evaluators,
  (select count(*) from public.evaluation_submissions) as evaluation_submissions,
  (select count(*) from public.evaluation_answers) as evaluation_answers;

select form_code, count(*) as submissions
from public.evaluation_submissions
group by form_code
order by form_code;

select s.form_code, a.answer_status, count(*) as answers
from public.evaluation_answers a
join public.evaluation_submissions s on s.id = a.submission_id
group by s.form_code, a.answer_status
order by s.form_code, a.answer_status;

select bp_code, count(*) as duplicate_count
from public.company_branches
where bp_code is not null
group by bp_code
having count(*) > 1;

select source_file_id, source_record_id, count(*) as duplicate_count
from public.evaluation_submissions
group by source_file_id, source_record_id
having count(*) > 1;

select submission_id, question_id, count(*) as duplicate_count
from public.evaluation_answers
group by submission_id, question_id
having count(*) > 1;

select count(*) as branches_without_company
from public.company_branches b
left join public.companies c on c.id = b.company_id
where c.id is null;

select count(*) as submissions_without_company
from public.evaluation_submissions s
left join public.companies c on c.id = s.company_id
where c.id is null;

select count(*) as answers_without_submission_or_question
from public.evaluation_answers a
left join public.evaluation_submissions s on s.id = a.submission_id
left join public.evaluation_questions q on q.id = a.question_id
where s.id is null or q.id is null;
