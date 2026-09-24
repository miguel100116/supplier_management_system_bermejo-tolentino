-- Narrow, atomic document renewal for Admins and employees explicitly granted
-- the renew-documents page permission. This does not widen partner_company
-- UPDATE RLS and cannot change company identity, classification, branches, or
-- profile/contact fields.

create or replace function public.renew_partner_document(
  p_company_id text,
  p_branch_id text,
  p_document_name text,
  p_expected_document jsonb,
  p_next_document jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_branch_index integer;
  v_match_count integer;
  v_current_document jsonb;
  v_next_payload jsonb;
  v_actor text := private.my_app_email();
  v_can_renew boolean;
  v_audit_id text := 'DOC-MOD-' || gen_random_uuid()::text;
  v_change text;
begin
  if not public.is_confirmed_mgenesis_user() then
    raise exception 'A confirmed Microgenesis account is required.' using errcode = '42501';
  end if;

  select coalesce(
    role = 'Admin'
    or 'renew-documents' = any(coalesce(permission_pages, array[]::text[])),
    false
  )
  into v_can_renew
  from public.app_profiles
  where email = v_actor
  limit 1;

  if not coalesce(v_can_renew, false) then
    raise exception 'Document renewal permission is required.' using errcode = '42501';
  end if;

  if p_company_id is null or length(p_company_id) not between 1 and 500
    or p_branch_id is null or length(p_branch_id) not between 1 and 500
    or p_document_name is null or length(p_document_name) not between 1 and 500 then
    raise exception 'Company, branch, and document identifiers are required.' using errcode = '22023';
  end if;

  if p_document_name <> all(array[
    'Confidentiality and Non-Disclosure Agreement',
    'Letter of Accreditation',
    'Supplier Code of Business Conduct and Ethics',
    'SIF', 'BIR2303', 'SEC (Corp)', 'Articles of Incorporation', 'AFS',
    'GIS (Corp)', 'DTI (Sole)', 'Business Permit', 'Import Permit',
    'Product Profile', 'Proof of Present Address',
    'Sole Proprietorship (Owner''s ID)', 'Other Documents',
    'Certificate of Incorporation', 'Business Permit/License', 'Owner''s ID'
  ]::text[]) then
    raise exception 'Unsupported compliance document.' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_expected_document, '{}'::jsonb)) <> 'object'
    or jsonb_typeof(p_next_document) <> 'object'
    or not (p_next_document ? 'provided')
    or jsonb_typeof(p_next_document -> 'provided') <> 'boolean'
    or exists (
      select 1 from jsonb_object_keys(p_next_document) as key
      where key not in ('provided', 'expiryDate')
    ) then
    raise exception 'Only provided and expiryDate may be changed.' using errcode = '22023';
  end if;

  if p_next_document ? 'expiryDate' then
    if jsonb_typeof(p_next_document -> 'expiryDate') <> 'string'
      or (p_next_document ->> 'expiryDate') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'expiryDate must use YYYY-MM-DD.' using errcode = '22023';
    end if;
    perform (p_next_document ->> 'expiryDate')::date;
  end if;

  if p_document_name = any(array['AFS', 'GIS (Corp)', 'DTI (Sole)', 'Business Permit', 'Import Permit', 'Business Permit/License']::text[])
    and not (p_next_document ? 'expiryDate') then
    raise exception 'This document requires an expiryDate.' using errcode = '22023';
  end if;

  select payload
  into v_payload
  from public.application_records
  where record_type = 'partner_company' and record_id = p_company_id
  for update;

  if v_payload is null then
    raise exception 'Partner company was not found.' using errcode = 'P0002';
  end if;

  select count(*), min(ordinality::integer - 1)
  into v_match_count, v_branch_index
  from jsonb_array_elements(coalesce(v_payload -> 'branches', '[]'::jsonb)) with ordinality as branch(value, ordinality)
  where branch.value ->> 'id' = p_branch_id;

  if v_match_count <> 1 then
    raise exception 'The branch identifier is missing or ambiguous.' using errcode = '22023';
  end if;

  v_current_document := coalesce(
    v_payload #> array['branches', v_branch_index::text, 'documents', p_document_name],
    '{}'::jsonb
  );
  if v_current_document is distinct from coalesce(p_expected_document, '{}'::jsonb) then
    raise exception 'The document changed since it was opened. Refresh and retry.' using errcode = '40001';
  end if;

  v_next_payload := jsonb_set(
    v_payload,
    array['branches', v_branch_index::text, 'documents'],
    coalesce(v_payload #> array['branches', v_branch_index::text, 'documents'], '{}'::jsonb),
    true
  );
  v_next_payload := jsonb_set(
    v_next_payload,
    array['branches', v_branch_index::text, 'documents', p_document_name],
    p_next_document,
    true
  );

  update public.application_records
  set payload = v_next_payload
  where record_type = 'partner_company' and record_id = p_company_id;

  v_change := case
    when p_next_document ? 'expiryDate' then 'Renewed - new expiry ' || (p_next_document ->> 'expiryDate')
    when (p_next_document ->> 'provided')::boolean then 'Marked provided'
    else 'Marked not provided'
  end;

  insert into public.application_records (record_type, record_id, payload, owner_id)
  values (
    'document_modification',
    v_audit_id,
    jsonb_build_object(
      'id', v_audit_id,
      'actorEmail', v_actor,
      'category', coalesce(v_payload ->> 'type', 'Unknown'),
      'companyName', coalesce(v_payload ->> 'name', p_company_id),
      'docName', p_document_name,
      'change', v_change,
      'timestamp', now()
    ),
    auth.uid()
  );

  return v_next_payload;
end;
$$;

revoke all on function public.renew_partner_document(text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.renew_partner_document(text, text, text, jsonb, jsonb) to authenticated;
