import assert from 'node:assert/strict';
import test from 'node:test';
import { compareDate, compareText, isWithinDateRange } from './tableFilters';

test('date ranges are inclusive and reject missing dates when active', () => {
  assert.equal(isWithinDateRange('2026-09-01T00:00:00Z', '2026-09-01', '2026-09-30'), true);
  assert.equal(isWithinDateRange('2026-09-30T23:59:59', '2026-09-01', '2026-09-30'), true);
  assert.equal(isWithinDateRange('2026-10-01T00:00:00Z', '2026-09-01', '2026-09-30'), false);
  assert.equal(isWithinDateRange(undefined, '2026-09-01', ''), false);
  assert.equal(isWithinDateRange(undefined, '', ''), true);
});

test('text and date comparators provide stable table ordering', () => {
  assert.ok(compareText('Alpha 2', 'Alpha 10') < 0);
  assert.ok(compareText('zeta', 'Alpha') > 0);
  assert.ok(compareDate('2026-09-01', '2026-09-02') < 0);
  assert.ok(compareDate(undefined, '2026-09-02') > 0);
});
