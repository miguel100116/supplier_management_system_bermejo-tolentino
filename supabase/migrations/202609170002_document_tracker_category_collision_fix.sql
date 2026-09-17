-- Correct overlapping Local/Foreign labels only when the current application
-- value exactly equals the non-applicable normalized source value. This fixes
-- import collisions without overwriting later manual Document Tracker edits.

do $$
declare
  correction record;
begin
  for correction in
    with shared_keys(target_key, local_key, foreign_key) as (
      values
        ('SIF', 'local.sif', 'foreign.sif'),
        ('Articles of Incorporation', 'local.articles_of_incorporation', 'foreign.articles_of_incorporation'),
        ('AFS', 'local.afs', 'foreign.afs'),
        ('Product Profile', 'local.product_profile', 'foreign.product_profile'),
        ('Other Documents', 'local.other_documents', 'foreign.other_documents')
    ), normalized_values as (
      select
        d.branch_id,
        d.document_key,
        jsonb_strip_nulls(jsonb_build_object(
          'provided', coalesce(nullif(trim(d.raw_value), '') is not null or d.expiry_date is not null, false),
          'expiryDate', d.expiry_date,
          'status', d.status,
          'daysLeft', d.days_left
        )) as value
      from public.company_documents d
    ), app_branches as (
      select
        ar.record_id,
        branch.ordinality - 1 as branch_index,
        branch.value as branch
      from public.application_records ar,
           lateral jsonb_array_elements(coalesce(ar.payload->'branches', '[]'::jsonb))
             with ordinality as branch(value, ordinality)
      where ar.record_type = 'partner_company'
    )
    select
      app.record_id,
      app.branch_index,
      keys.target_key,
      case when b.partner_type = 'Supplier' and b.supplier_origin = 'Foreign'
        then foreign_doc.value else local_doc.value end as expected_value
    from public.company_branches b
    cross join shared_keys keys
    join app_branches app on app.branch->>'id' = b.id::text
    left join normalized_values local_doc
      on local_doc.branch_id = b.id and local_doc.document_key = keys.local_key
    left join normalized_values foreign_doc
      on foreign_doc.branch_id = b.id and foreign_doc.document_key = keys.foreign_key
    where coalesce(b.partner_type, 'Uncategorized') <> 'Uncategorized'
      and app.branch->'documents'->keys.target_key = case
        when b.partner_type = 'Supplier' and b.supplier_origin = 'Foreign'
          then local_doc.value else foreign_doc.value end
      and app.branch->'documents'->keys.target_key is distinct from case
        when b.partner_type = 'Supplier' and b.supplier_origin = 'Foreign'
          then foreign_doc.value else local_doc.value end
  loop
    update public.application_records
    set payload = jsonb_set(
      payload,
      array['branches', correction.branch_index::text, 'documents', correction.target_key],
      coalesce(correction.expected_value, '{}'::jsonb),
      true
    )
    where record_type = 'partner_company'
      and record_id = correction.record_id;
  end loop;
end;
$$;
