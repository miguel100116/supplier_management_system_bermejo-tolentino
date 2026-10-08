import assert from 'node:assert/strict';
import test from 'node:test';
import type { CustomForm, SurveyType } from '../../../types/survey';
import type { PersistedProfile } from '../../account-management/domain/accountProfile';
import { getEligibleFormRecipients } from './formRecipients';

const form: CustomForm = {
  id: 'supplier-form', title: 'Supplier evaluation', surveyType: 'Supplier', description: '', createdAt: '2026-10-01',
  questions: [], accessDepartments: ['Procurement Group'], accessRoles: ['Managerial', 'Rank & File'],
};
const profile = (email: string, department: PersistedProfile['department'], designation: PersistedProfile['designation'], surveyTypes?: SurveyType[]): PersistedProfile => ({
  email, role: 'Employee', department, designation,
  ...(surveyTypes ? { permissions: { pages: [], surveyTypes } } : {}),
});

test('recipients must pass account, department, designation, and survey access rules', () => {
  const profiles = [
    profile('eligible@mgenesis.com', 'Procurement Group', 'Managerial'),
    profile('category-denied@mgenesis.com', 'Procurement Group', 'Managerial', ['Courier']),
    profile('department-denied@mgenesis.com', 'Logistics', 'Managerial'),
    profile('role-denied@mgenesis.com', 'Procurement Group', 'Supervisory'),
    { ...profile('admin@mgenesis.com', 'Procurement Group', 'Managerial'), role: 'Admin' as const },
  ];
  assert.deepEqual(getEligibleFormRecipients(form, profiles, {}).map(({ email }) => email), ['eligible@mgenesis.com']);
  assert.deepEqual(getEligibleFormRecipients(form, [profiles[0]], { 'Procurement Group': { surveyTypes: ['Courier'] } }), []);
});
