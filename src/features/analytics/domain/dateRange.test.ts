import assert from 'node:assert/strict';
import test from 'node:test';
import type { SurveyResponse } from '../../../types/survey';
import { filterCustomAnalyticsResponses, getAnalyticsDateRangeError } from './dateRange';

function response(id: string, date: string, seriesId?: string): SurveyResponse {
  return { responseId: id, surveyType: 'Supplier', company: 'Example Supplier', respondentType: 'Employee', submissionDate: date, questionId: 'Q01', questionNumber: 1, question: 'Example', questionCategory: 'Quality', rating: 1, comment: '', ...(seriesId ? { seriesId, archived: true } : {}) };
}

test('custom date ranges include both local calendar day boundaries across active and archived data', () => {
  const rows = [
    response('before', new Date(2026, 8, 9, 23, 59, 59, 999).toISOString()),
    response('start', new Date(2026, 8, 10, 0, 0, 0).toISOString()),
    response('end', new Date(2026, 8, 12, 23, 59, 59, 999).toISOString(), 'period-1'),
    response('after', new Date(2026, 8, 13, 0, 0, 0).toISOString()),
  ];
  assert.deepEqual(filterCustomAnalyticsResponses(rows, { from: '2026-09-10', to: '2026-09-12' }).map((r) => r.responseId), ['start', 'end']);
});

test('custom dates support same-day and open-ended ranges and exclude invalid submission dates when filtered', () => {
  const rows = [response('first', '2026-09-10T12:00:00'), response('second', '2026-09-11T12:00:00'), response('invalid', 'not-a-date')];
  assert.deepEqual(filterCustomAnalyticsResponses(rows, { from: '2026-09-10', to: '2026-09-10' }).map((r) => r.responseId), ['first']);
  assert.deepEqual(filterCustomAnalyticsResponses(rows, { from: '', to: '2026-09-10' }).map((r) => r.responseId), ['first']);
  assert.deepEqual(filterCustomAnalyticsResponses(rows, { from: '2026-09-11', to: '' }).map((r) => r.responseId), ['second']);
  assert.deepEqual(filterCustomAnalyticsResponses(rows, { from: '', to: '' }), rows);
});

test('optional archived periods narrow the date range without changing or mutating source rows', () => {
  const rows = [response('active', '2026-09-10T12:00:00'), response('archived', '2026-09-10T12:00:00', 'period-1'), response('outside', '2026-10-01T12:00:00', 'period-1')];
  const before = JSON.stringify(rows);
  assert.deepEqual(filterCustomAnalyticsResponses(rows, { from: '2026-09-01', to: '2026-09-30' }, ['period-1']).map((r) => r.responseId), ['archived']);
  assert.equal(JSON.stringify(rows), before);
});

test('invalid and reversed calendar ranges are rejected while valid leap dates are accepted', () => {
  assert.equal(getAnalyticsDateRangeError({ from: '2026-02-30', to: '' }), 'Please choose valid calendar dates.');
  assert.equal(getAnalyticsDateRangeError({ from: 'invalid', to: '' }), 'Please choose valid calendar dates.');
  assert.equal(getAnalyticsDateRangeError({ from: '2026-09-12', to: '2026-09-10' }), 'From date must be on or before To date.');
  assert.equal(getAnalyticsDateRangeError({ from: '2028-02-29', to: '2028-02-29' }), null);
  assert.deepEqual(filterCustomAnalyticsResponses([response('row', '2026-09-11T12:00:00')], { from: '2026-09-12', to: '2026-09-10' }), []);
});
