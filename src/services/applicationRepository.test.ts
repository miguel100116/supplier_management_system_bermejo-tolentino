import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { SurveyResponse } from '../types/survey';
import { APPLICATION_RECORD_TYPES, surveyResponseRecordId } from './applicationRepository';

test('uses the submission and question IDs as the stable response-row key', () => {
  const response = {
    responseId: 'response-1',
    questionId: 'Q-SUP-01',
  } as SurveyResponse;
  assert.equal(surveyResponseRecordId(response), 'response-1:Q-SUP-01');
});

test('keeps frontend application record types aligned with the latest database constraint', () => {
  const migration = readFileSync(
    new URL('../../supabase/migrations/202609230001_active_company_snapshots.sql', import.meta.url),
    'utf8',
  );
  const constraint = migration.match(/add constraint application_records_record_type_check check \(record_type in \(([\s\S]*?)\)\);/i);
  assert.ok(constraint, 'latest application-record constraint was not found');
  const databaseTypes = [...constraint[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(databaseTypes, [...APPLICATION_RECORD_TYPES].sort());
});
