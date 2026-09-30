import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { SurveyResponse } from '../types/survey';
import {
  APPLICATION_RECORD_TYPES,
  batchApplicationRecordPageRanges,
  applicationRecordPageRanges,
  incompleteApplicationRecordPageRange,
  parsePersistedProfile,
  surveyResponseRecordId,
} from './applicationRepository';
import { parseApplicationRecordPayload } from './applicationRecordSchemas';

const now = '2026-09-24T00:00:00.000Z';

const validApplicationRecords: Record<(typeof APPLICATION_RECORD_TYPES)[number], { id: string; payload: unknown }> = {
  partner_company: { id: 'company-1', payload: { id: 'company-1', name: 'Supplier One', type: 'Supplier', createdAt: now, branches: [] } },
  survey: { id: 'survey-1', payload: { id: 'survey-1', title: 'Supplier Survey', surveyType: 'Supplier', description: '', createdAt: now, archivedAt: now, status: 'Archived', questions: [{ questionId: 'q1', questionNumber: 1, question: 'Quality?', questionCategory: 'Quality' }] } },
  survey_response: { id: 'response-1:q1', payload: { responseId: 'response-1', surveyType: 'Supplier', respondentType: 'Employee', submissionDate: now, company: 'Supplier One', questionId: 'q1', questionNumber: 1, question: 'Quality?', questionCategory: 'Quality', rating: 4, comment: '' } },
  archive_series: { id: 'series-1', payload: { id: 'series-1', label: 'First Half', createdAt: now } },
  department_permission: { id: 'Logistics', payload: { department: 'Logistics', pages: ['dashboard'], surveyTypes: ['Courier'] } },
  category_labels: { id: 'global', payload: { Courier: ['Delivery'], Supplier: ['Quality'], Subcontractor: ['Safety'] } },
  feedback_contact: { id: 'contact-1', payload: { id: 'contact-1', companyName: 'Supplier One', partnerType: 'Supplier', contactPerson: '', email: '', ccEmails: [], updatedAt: now } },
  feedback_report: { id: 'report-1', payload: { id: 'report-1', surveyId: 'survey-1', surveyTitle: 'Survey', companyName: 'Supplier One', surveyType: 'Supplier', periodCovered: '2026', recipientEmail: 'partner@example.com', ccEmails: [], subject: 'Report', body: 'Body', status: 'Queued', queuedAt: now, timerDurationMinutes: 30, expiresAt: now, queuedBy: 'admin@mgenesis.com', responseCount: 3, overallScore: 90, history: [] } },
  feedback_settings: { id: 'global', payload: { defaultTimerMinutes: 30 } },
  document_notification_rule: { id: 'AFS', payload: { docName: 'AFS', label: 'AFS', origin: 'Both', mode: 'fiscal-year', enabled: true, earlyMilestoneDays: [], note: '' } },
  notification_read_state: { id: 'user-uuid', payload: { userEmail: 'user@mgenesis.com', readNotificationIds: [], updatedAt: now } },
  admin_activity: { id: 'activity-1', payload: { id: 'activity-1', action: 'Updated settings', timestamp: now } },
  document_modification: { id: 'change-1', payload: { id: 'change-1', actorEmail: 'admin@mgenesis.com', category: 'Supplier', companyName: 'Supplier One', docName: 'AFS', change: 'Renewed', timestamp: now } },
  export_history: { id: 'export-1', payload: { id: 'export-1', title: 'Report', format: 'pdf', filename: 'report.pdf', exportedAt: now } },
  supplier_ranking_history: { id: 'rank-1', payload: { id: 'rank-1', actorEmail: 'admin@mgenesis.com', timestamp: now, changedCount: 1, snapshot: [{ rank: 1, companyId: 'company-1', companyName: 'Supplier One' }] } },
  employee_notification_state: { id: 'user@mgenesis.com', payload: { id: 'user@mgenesis.com', userEmail: 'user@mgenesis.com', readIds: [], deletedIds: [], updatedAt: now } },
  reminder_settings: { id: 'global', payload: { id: 'global', frequencyHours: '24', updatedAt: now } },
  compliance_snapshot: { id: 'Supplier', payload: { id: 'Supplier', snapshots: [{ date: now, rate: 95, total: 20 }] } },
  active_company_snapshot: { id: 'supplier-snapshot-1', payload: { id: 'supplier-snapshot-1', surveyType: 'Supplier', uploadedAt: now, uploadedBy: 'admin@mgenesis.com', sourceFileName: 'suppliers.xlsx', companies: ['Supplier One'] } },
  evaluation_import_archive: { id: 'import-archive-1', payload: { id: 'import-archive-1', surveyType: 'Supplier', uploadedAt: now, uploadedBy: 'admin@mgenesis.com', sourceFileName: 'supplier-results.xlsx', storagePath: 'supplier/2026-09-24/import-archive-1.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileSize: 128, importBatchId: 'client-csv:supplier:sha256' } },
};

test('uses the submission and question IDs as the stable response-row key', () => {
  const response = {
    responseId: 'response-1',
    questionId: 'Q-SUP-01',
  } as SurveyResponse;
  assert.equal(surveyResponseRecordId(response), 'response-1:Q-SUP-01');
});

test('splits application-record reads into complete, non-overlapping pages', () => {
  assert.deepEqual(applicationRecordPageRanges(0), []);
  assert.deepEqual(applicationRecordPageRanges(1), [[0, 0]]);
  assert.deepEqual(applicationRecordPageRanges(1_001), [[0, 999], [1_000, 1_000]]);
  assert.deepEqual(applicationRecordPageRanges(1_001, 500), [
    [0, 499],
    [500, 999],
    [1_000, 1_000],
  ]);
});

test('fetches the documented response dataset in one bounded follow-up page batch', () => {
  const remainingPages = applicationRecordPageRanges(6_355).slice(1);
  const batches = batchApplicationRecordPageRanges(remainingPages);

  assert.equal(remainingPages.length, 6);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 6);
  assert.deepEqual(batches.flat(), remainingPages);
  assert.deepEqual(batchApplicationRecordPageRanges(remainingPages, 5).map((batch) => batch.length), [5, 1]);
  assert.deepEqual(batchApplicationRecordPageRanges(remainingPages, 0), []);
});

test('keeps application-record page requests within the configured Supabase API row limit', () => {
  const config = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8');
  const maxRows = Number(config.match(/^max_rows\s*=\s*(\d+)/m)?.[1]);
  assert.ok(Number.isInteger(maxRows) && maxRows > 0);
  assert.ok(applicationRecordPageRanges(maxRows + 1).every(([from, to]) => to - from + 1 <= maxRows));
});

test('finds the contiguous remainder when Supabase caps a requested page', () => {
  assert.deepEqual(incompleteApplicationRecordPageRange(0, 999, 500), [500, 999]);
  assert.deepEqual(incompleteApplicationRecordPageRange(500, 999, 250), [750, 999]);
  assert.equal(incompleteApplicationRecordPageRange(0, 999, 1_000), null);
  assert.equal(incompleteApplicationRecordPageRange(0, 999, 0), null);
});

test('keeps frontend application record types aligned with the latest database constraint', () => {
  const migration = readFileSync(
    new URL('../../supabase/migrations/202609300001_evaluation_import_archives.sql', import.meta.url),
    'utf8',
  );
  const constraint = migration.match(/add constraint application_records_record_type_check check \(record_type in \(([\s\S]*?)\)\);/i);
  assert.ok(constraint, 'latest application-record constraint was not found');
  const databaseTypes = [...constraint[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(databaseTypes, [...APPLICATION_RECORD_TYPES].sort());
});

test('validates and normalizes profiles at the repository boundary', () => {
  assert.deepEqual(parsePersistedProfile({
    email: '  EMPLOYEE@MGENESIS.COM ',
    role: 'Employee',
    designation: 'Supervisory',
    department: 'Logistics',
    permission_pages: ['dashboard', 'analytics', 'dashboard'],
    permission_survey_types: ['Courier', 'Supplier'],
  }), {
    email: 'employee@mgenesis.com',
    role: 'Employee',
    designation: 'Supervisory',
    department: 'Logistics',
    permissions: {
      pages: ['dashboard', 'analytics'],
      surveyTypes: ['Courier', 'Supplier'],
    },
  });
});

test('rejects unsupported profile authorization values', () => {
  const base = {
    email: 'employee@mgenesis.com',
    role: 'Employee',
    designation: 'Rank & File',
    department: 'Logistics',
  };

  assert.throws(() => parsePersistedProfile({ ...base, role: 'SuperAdmin' }), /role is invalid/);
  assert.throws(() => parsePersistedProfile({ ...base, designation: 'Owner' }), /designation is invalid/);
  assert.throws(() => parsePersistedProfile({ ...base, department: 'Unknown' }), /department is invalid/);
  assert.throws(() => parsePersistedProfile({ ...base, permission_pages: ['database-admin'] }), /permission_pages/);
  assert.throws(() => parsePersistedProfile({ ...base, permission_survey_types: ['All'] }), /permission_survey_types/);
  assert.throws(() => parsePersistedProfile({ ...base, email: 'employee@example.com' }), /@mgenesis\.com/);
});

test('validates every application record type at the repository boundary', () => {
  assert.deepEqual(Object.keys(validApplicationRecords).sort(), [...APPLICATION_RECORD_TYPES].sort());
  for (const recordType of APPLICATION_RECORD_TYPES) {
    const { id, payload } = validApplicationRecords[recordType];
    assert.doesNotThrow(() => parseApplicationRecordPayload(recordType, payload, id), recordType);
  }
});

test('rejects malformed and mismatched application records without trusting TypeScript casts', () => {
  assert.throws(() => parseApplicationRecordPayload('partner_company', { id: 'other' }, 'company-1'), /record ID|name/);
  assert.throws(() => parseApplicationRecordPayload('survey_response', { ...validApplicationRecords.survey_response.payload as object, rating: Number.NaN }, 'response-1:q1'), /finite number/);
  assert.throws(() => parseApplicationRecordPayload('department_permission', { department: 'Logistics', pages: ['database-admin'], surveyTypes: ['Courier'] }, 'Logistics'), /unsupported value/);
  assert.throws(() => parseApplicationRecordPayload('reminder_settings', { id: 'global', frequencyHours: '-1', updatedAt: now }, 'global'), /positive/);
});

test('validates archived survey timestamps at the persistence boundary', () => {
  const survey = validApplicationRecords.survey;
  assert.doesNotThrow(() => parseApplicationRecordPayload('survey', survey.payload, survey.id));
  assert.throws(
    () => parseApplicationRecordPayload('survey', { ...survey.payload as object, archivedAt: 'not-a-date' }, survey.id),
    /archivedAt/,
  );
});

test('normalizes supported legacy survey-response fields before hydration', () => {
  const legacy = {
    ...validApplicationRecords.survey_response.payload as object,
    surveyType: 'Contractor',
    respondentType: null,
    submissionDate: null,
    questionCategory: 'General',
    rating: null,
    comment: null,
  };
  const parsed = parseApplicationRecordPayload('survey_response', legacy, 'response-1:q1', {
    recordCreatedAt: '2026-09-20T10:30:00.000Z',
  }) as Record<string, unknown>;
  assert.equal(parsed.surveyType, 'Courier');
  assert.equal(parsed.respondentType, 'Unspecified');
  assert.equal(parsed.submissionDate, '2026-09-20T10:30:00.000Z');
  assert.equal(parsed.submissionDateInferredFrom, 'recordCreatedAt');
  assert.equal(parsed.questionCategory, 'Overall');
  assert.equal(parsed.rating, 'N/A');
  assert.equal(parsed.comment, '');
  assert.throws(() => parseApplicationRecordPayload('survey_response', {
    ...legacy,
    surveyType: 'Unknown',
  }, 'response-1:q1'), /surveyType has an unsupported value/);
  assert.throws(() => parseApplicationRecordPayload('survey_response', {
    ...legacy,
    respondentType: 42,
  }, 'response-1:q1', { recordCreatedAt: now }), /respondentType must be text/);
  assert.throws(() => parseApplicationRecordPayload(
    'survey_response',
    legacy,
    'response-1:q1',
  ), /no trustworthy fallback timestamp/);
  assert.throws(() => parseApplicationRecordPayload('survey_response', {
    ...legacy,
    submissionDate: 'not-a-date',
  }, 'response-1:q1', { recordCreatedAt: now }), /submissionDate must be a valid date/);
});

test('rejects invalid dates and oversized collections while accepting the supported legacy date shape', () => {
  const company = validApplicationRecords.partner_company.payload as Record<string, unknown>;
  assert.doesNotThrow(() => parseApplicationRecordPayload('partner_company', {
    ...company,
    registeredAt: '24/09/2026',
  }, 'company-1'));
  assert.throws(() => parseApplicationRecordPayload('partner_company', {
    ...company,
    registeredAt: '31/02/2026',
  }, 'company-1'), /valid date/);
  assert.throws(() => parseApplicationRecordPayload('partner_company', {
    ...company,
    branches: Array.from({ length: 501 }, (_, index) => ({ id: `branch-${index}`, bpCode: '' })),
  }, 'company-1'), /bounded list/);
  assert.throws(() => parseApplicationRecordPayload('active_company_snapshot', {
    ...validApplicationRecords.active_company_snapshot.payload as object,
    companies: Array.from({ length: 10_001 }, (_, index) => `Company ${index}`),
  }, 'supplier-snapshot-1'), /invalid stored shape/i);
});
