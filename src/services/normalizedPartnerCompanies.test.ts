import assert from 'node:assert/strict';
import test from 'node:test';
import { mapNormalizedCompany, type NormalizedCompanyRow } from './normalizedPartnerCompanies';

test('maps normalized company, branch, and document rows to the application contract', () => {
  const row: NormalizedCompanyRow = {
    id: 'company-1',
    canonical_name: 'Example Supplier',
    created_at: '2026-09-16T00:00:00Z',
    company_branches: [{
      id: 'branch-1',
      bp_code: 'BP-1',
      partner_type: 'Supplier',
      supplier_origin: 'Local',
      supplier_rank_raw: 'Major',
      address: 'Makati',
      federal_tax_id: null,
      industry: null,
      contact_person: null,
      contact_position: null,
      mobile_phone: null,
      email: 'supplier@example.com',
      category_raw: 'Supplier-Local',
      date_accredited: '2026-01-02',
      status: 'Accredited',
      source_row_number: 12,
      company_documents: [{
        document_key: 'business_permit',
        raw_value: 'submitted',
        expiry_date: '2026-12-31',
        status: 'Current',
        days_left: 106,
      }],
    }],
  };

  const company = mapNormalizedCompany(row);
  assert.equal(company.name, 'Example Supplier');
  assert.equal(company.type, 'Supplier');
  assert.equal(company.supplierOrigin, 'Local');
  assert.equal(company.accreditationStatus, 'Accredited');
  assert.equal(company.branches?.[0].documents?.business_permit.expiryDate, '2026-12-31');
});

test('keeps evaluation-only companies without a typed branch uncategorized', () => {
  const company = mapNormalizedCompany({
    id: 'company-2',
    canonical_name: 'Evaluation Only',
    created_at: '2026-09-16T00:00:00Z',
    company_branches: [],
  });

  assert.equal(company.type, 'Uncategorized');
  assert.deepEqual(company.branches, []);
});
