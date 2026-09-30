import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const PARTNER_COMPANIES_SOURCE = readFileSync(
  new URL('../../../pages/PartnerCompaniesPage.tsx', import.meta.url),
  'utf8',
);
const FILTER_TOOLBAR_SOURCE = readFileSync(
  new URL('./PartnerCompaniesFilterToolbar.tsx', import.meta.url),
  'utf8',
);

test('category and supplier-rank tables fit their cards without horizontal scrolling', () => {
  const breakdown = PARTNER_COMPANIES_SOURCE.match(
    /\{\/\* Category & Supplier Rank Breakdown[\s\S]*?<PartnerCompaniesFilterToolbar/,
  )?.[0];

  assert.ok(breakdown);
  assert.doesNotMatch(breakdown, /overflow-x-auto/);
  assert.doesNotMatch(breakdown, /min-w-\[480px\]/);
  assert.equal(breakdown.match(/w-full table-fixed text-sm/g)?.length, 2);
  assert.equal(breakdown.match(/w-20 px-3 py-2 text-right sm:w-24 sm:px-4">Branches/g)?.length, 2);
});

test('SMS-22 groups registry controls into compact selects and one advanced filter disclosure', () => {
  assert.match(PARTNER_COMPANIES_SOURCE, /<PartnerCompaniesFilterToolbar/);
  assert.match(PARTNER_COMPANIES_SOURCE, /Registry description stays immediately above the table/);
  assert.ok(PARTNER_COMPANIES_SOURCE.indexOf('<PartnerCompaniesFilterToolbar') < PARTNER_COMPANIES_SOURCE.indexOf('Registry description stays immediately above the table'));

  assert.match(FILTER_TOOLBAR_SOURCE, /Filter partners by status/);
  assert.match(FILTER_TOOLBAR_SOURCE, /Filter partners by category/);
  assert.match(FILTER_TOOLBAR_SOURCE, /Register New Partner/);
  assert.match(FILTER_TOOLBAR_SOURCE, /placeholder="Search by name or BP Code\.\.\."/);
  assert.match(FILTER_TOOLBAR_SOURCE, /aria-controls="partner-company-advanced-filters"/);
  assert.match(FILTER_TOOLBAR_SOURCE, /advancedFilterCount/);
  assert.match(FILTER_TOOLBAR_SOURCE, /Reset all partner filters/);
  assert.match(FILTER_TOOLBAR_SOURCE, /Registration date/);
  assert.match(FILTER_TOOLBAR_SOURCE, /Document expiration/);
});

test('archived partners record and display the archive date and time', () => {
  const surveyTypesSource = readFileSync(
    new URL('../../../types/survey.ts', import.meta.url),
    'utf8',
  );
  const recordSchemasSource = readFileSync(
    new URL('../../../services/applicationRecordSchemas.ts', import.meta.url),
    'utf8',
  );

  assert.match(surveyTypesSource, /archivedAt\?: string/);
  assert.match(recordSchemasSource, /optionalDate\(candidate\.archivedAt, `\$\{label\}\.archivedAt`\)/);
  assert.match(PARTNER_COMPANIES_SOURCE, /archivedAt: nextIsArchived \? new Date\(\)\.toISOString\(\) : undefined/);
  assert.match(PARTNER_COMPANIES_SOURCE, /companyToArchive/);
  assert.match(PARTNER_COMPANIES_SOURCE, /Are you sure you want to archive/);
  assert.match(PARTNER_COMPANIES_SOURCE, /Confirm Archive/);
  assert.doesNotMatch(PARTNER_COMPANIES_SOURCE, /window\.confirm/);
  assert.match(PARTNER_COMPANIES_SOURCE, /Archived Date &amp; Time/);
  assert.match(PARTNER_COMPANIES_SOURCE, /formatDateTime\(c\.archivedAt\)/);
});
