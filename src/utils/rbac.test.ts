import assert from 'node:assert/strict';
import test from 'node:test';
import { getEffectiveSurveyTypes, hasPageAccess } from './rbac';

test('account survey-type restrictions remain the effective boundary', () => {
  assert.deepEqual(getEffectiveSurveyTypes(['Courier']), ['Courier']);
  assert.deepEqual(getEffectiveSurveyTypes(['Courier', 'Courier']), ['Courier']);
});

test('account-management page access does not turn an employee into an administrator', () => {
  assert.equal(hasPageAccess(['account-management'], 'analytics', false), false);
  assert.equal(hasPageAccess(['account-management'], 'analytics', true), true);
});
