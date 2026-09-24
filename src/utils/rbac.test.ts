import assert from 'node:assert/strict';
import test from 'node:test';
import { getDefaultPermissions, getDepartmentDefaultPermissions, getEffectiveSurveyTypes, hasPageAccess } from './rbac';

test('account survey-type restrictions remain the effective boundary', () => {
  assert.deepEqual(getEffectiveSurveyTypes(['Courier']), ['Courier']);
  assert.deepEqual(getEffectiveSurveyTypes(['Courier', 'Courier']), ['Courier']);
});

test('account-management page access does not turn an employee into an administrator', () => {
  assert.equal(hasPageAccess(['account-management'], 'analytics', false), false);
  assert.equal(hasPageAccess(['account-management'], 'analytics', true), true);
});

test('Archive Center is Admin-only even when an employee has a stale custom override', () => {
  assert.equal(hasPageAccess(['archive'], 'archive', false), false);
  assert.equal(hasPageAccess([], 'archive', true), true);
  assert.equal(getDefaultPermissions('Managerial', 'TASS').pages.includes('archive'), false);
  assert.equal(getDefaultPermissions('Director', 'Business Solutions Manager').pages.includes('archive'), false);
  assert.equal(getDepartmentDefaultPermissions('TASS').pages.includes('archive'), false);
});
