-- Align imported document keys in the editable application store with the
-- labels used by Document Tracker. The normalized import tables keep their
-- stable source keys; the frontend adapter also maps them defensively.

with document_key_map(source_key, target_key) as (
  values
    ('common.confidentiality_nda', 'Confidentiality and Non-Disclosure Agreement'),
    ('common.letter_of_accreditation', 'Letter of Accreditation'),
    ('common.supplier_code_of_conduct', 'Supplier Code of Business Conduct and Ethics'),
    ('local.sif', 'SIF'),
    ('local.bir_2303', 'BIR2303'),
    ('local.sec_corporation', 'SEC (Corp)'),
    ('local.articles_of_incorporation', 'Articles of Incorporation'),
    ('local.afs', 'AFS'),
    ('local.gis_corporation', 'GIS (Corp)'),
    ('local.dti_sole', 'DTI (Sole)'),
    ('local.business_permit', 'Business Permit'),
    ('local.import_permit', 'Import Permit'),
    ('local.product_profile', 'Product Profile'),
    ('local.proof_of_present_address', 'Proof of Present Address'),
    ('local.owners_id', 'Sole Proprietorship (Owner''s ID)'),
    ('local.other_documents', 'Other Documents'),
    ('foreign.sif', 'SIF'),
    ('foreign.articles_of_incorporation', 'Articles of Incorporation'),
    ('foreign.certificate_of_incorporation', 'Certificate of Incorporation'),
    ('foreign.afs', 'AFS'),
    ('foreign.business_permit_license', 'Business Permit/License'),
    ('foreign.owners_id', 'Owner''s ID'),
    ('foreign.product_profile', 'Product Profile'),
    ('foreign.other_documents', 'Other Documents')
), rebuilt as (
  select
    ar.record_type,
    ar.record_id,
    jsonb_set(
      ar.payload,
      '{branches}',
      coalesce(jsonb_agg(
        jsonb_set(
          branch.value,
          '{documents}',
          coalesce((
            select jsonb_object_agg(
              coalesce(mapping.target_key, document.key),
              document.value
              order by (mapping.source_key is null), document.key
            )
            from jsonb_each(coalesce(branch.value->'documents', '{}'::jsonb)) as document
            left join document_key_map mapping on mapping.source_key = document.key
          ), '{}'::jsonb),
          true
        )
        order by branch.ordinality
      ), '[]'::jsonb),
      true
    ) as payload
  from public.application_records ar
  cross join lateral jsonb_array_elements(coalesce(ar.payload->'branches', '[]'::jsonb))
    with ordinality as branch(value, ordinality)
  where ar.record_type = 'partner_company'
  group by ar.record_type, ar.record_id, ar.payload
)
update public.application_records target
set payload = rebuilt.payload
from rebuilt
where target.record_type = rebuilt.record_type
  and target.record_id = rebuilt.record_id
  and target.payload is distinct from rebuilt.payload;
