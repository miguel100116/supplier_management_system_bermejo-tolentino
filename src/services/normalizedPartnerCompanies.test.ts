import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mapNormalizedCompany,
  normalizeDatabasePartnerCompany,
  type NormalizedCompanyRow,
} from './normalizedPartnerCompanies';

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
        document_key: 'local.business_permit',
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
  assert.equal(company.branches?.[0].documents?.['Business Permit'].expiryDate, '2026-12-31');
});

test('maps database document keys to Document Tracker labels and preserves later canonical edits', () => {
  const company = normalizeDatabasePartnerCompany({
    id: 'company-3',
    name: 'Mapped Supplier',
    type: 'Supplier',
    supplierOrigin: 'Local',
    createdAt: '2026-09-17T00:00:00Z',
    branches: [{
      id: 'branch-3',
      bpCode: 'BP-3',
      documents: {
        'local.business_permit': { provided: true, expiryDate: '2026-10-01' },
        'Business Permit': { provided: true, expiryDate: '2027-10-01' },
        'common.confidentiality_nda': { provided: true, status: 'Current' },
      },
    }],
  });

  assert.deepEqual(company.branches?.[0].documents, {
    'Business Permit': { provided: true, expiryDate: '2027-10-01' },
    'Confidentiality and Non-Disclosure Agreement': { provided: true, status: 'Current' },
  });
});

test('uses only the category-applicable document block when local and foreign keys overlap', () => {
  const company = normalizeDatabasePartnerCompany({
    id: 'company-foreign',
    name: 'Foreign Supplier',
    type: 'Supplier',
    supplierOrigin: 'Foreign',
    createdAt: '2026-09-17T00:00:00Z',
    branches: [{
      id: 'branch-foreign',
      bpCode: 'BP-F',
      documents: {
        'local.afs': { provided: true, expiryDate: '2025-05-05' },
        'foreign.afs': { provided: true, expiryDate: '2025-02-25' },
      },
    }],
  });

  assert.deepEqual(company.branches?.[0].documents, {
    AFS: { provided: true, expiryDate: '2025-02-25' },
  });
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
