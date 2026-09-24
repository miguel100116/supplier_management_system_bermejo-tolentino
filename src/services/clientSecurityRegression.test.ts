import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const DESTRUCTIVE_ACTION_PAGES = [
  new URL('../pages/PartnerCompaniesPage.tsx', import.meta.url),
  new URL('../pages/SurveyFormsPage.tsx', import.meta.url),
];

const PARTNER_COMPANIES_SOURCE = readFileSync(new URL('../pages/PartnerCompaniesPage.tsx', import.meta.url), 'utf8');
const ARCHIVE_SOURCE = readFileSync(new URL('../pages/ArchivePage.tsx', import.meta.url), 'utf8');
const REPOSITORY_SOURCE = readFileSync(new URL('./applicationRepository.ts', import.meta.url), 'utf8');

test('destructive actions do not rely on browser-side shared passcodes', () => {
  for (const page of DESTRUCTIVE_ACTION_PAGES) {
    const source = readFileSync(page, 'utf8');

    assert.doesNotMatch(source, /adminPasscode|validCodes|archivePasscode|resetPasscode/);
    assert.doesNotMatch(source, /enter (?:an? )?(?:administrator|admin) passcode/i);
    assert.doesNotMatch(source, /type=["']password["']/i);
  }
});

test('authorization-sensitive success messages follow awaited remote mutations', () => {
  assert.match(PARTNER_COMPANIES_SOURCE, /await onRemoveCompany\([\s\S]*?setSuccessMessage/);
  assert.match(PARTNER_COMPANIES_SOURCE, /await onRenewDocument\([\s\S]*?setSuccessMessage/);
  assert.match(ARCHIVE_SOURCE, /await onRestoreResponseGroup\([\s\S]*?setSuccessMessage/);
  assert.match(ARCHIVE_SOURCE, /await onDeleteArchivedResponseGroups!?\([\s\S]*?setSuccessMessage/);
});

test('rejected and partial repository writes request an authoritative refetch', () => {
  assert.match(REPOSITORY_SOURCE, /reason: 'write-rejected'/);
  assert.match(REPOSITORY_SOURCE, /replaceApplicationRecords[\s\S]*?upsertApplicationRecords[\s\S]*?deleteApplicationRecords/);
  assert.ok(
    (REPOSITORY_SOURCE.match(/requestAuthoritativeRefresh\(recordType\)/g) ?? []).length >= 4,
    'read, upsert, delete, and reconciliation failures must request refresh',
  );
});
