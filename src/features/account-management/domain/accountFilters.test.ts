import assert from 'node:assert/strict';
import test from 'node:test';
import type { PersistedProfile } from '../../../services/applicationRepository';
import { filterAndSortAccounts } from './accountFilters';

const accounts: PersistedProfile[] = [
  { email: 'admin@example.com', role: 'Admin', designation: 'Rank & File', department: 'Logistics' },
  { email: 'employee@example.com', role: 'Employee', designation: 'Executive', department: 'TASS' },
  { email: 'another.employee@example.com', role: 'Employee', designation: 'Rank & File', department: 'Logistics' },
];

test('account role filters use system role and preserve all accounts in All', () => {
  assert.deepEqual(filterAndSortAccounts(accounts, 'All', '', 'email-asc').map((account) => account.email), [
    'admin@example.com', 'another.employee@example.com', 'employee@example.com',
  ]);
  assert.deepEqual(filterAndSortAccounts(accounts, 'Admin', '', 'email-asc').map((account) => account.email), [
    'admin@example.com',
  ]);
  assert.deepEqual(filterAndSortAccounts(accounts, 'Employee', '', 'email-asc').map((account) => account.email), [
    'another.employee@example.com', 'employee@example.com',
  ]);
  assert.deepEqual(filterAndSortAccounts(accounts, 'Admin', 'no-match', 'email-asc'), []);
  assert.deepEqual(filterAndSortAccounts(accounts, 'Employee', '', 'email-asc').map((account) => account.email), [
    'another.employee@example.com', 'employee@example.com',
  ]);
});

test('account role filtering composes with search and ignores designation for classification', () => {
  assert.deepEqual(filterAndSortAccounts(accounts, 'Admin', 'logistics', 'email-asc').map((account) => account.email), [
    'admin@example.com',
  ]);
  assert.deepEqual(filterAndSortAccounts(accounts, 'Employee', 'executive', 'email-asc').map((account) => account.email), [
    'employee@example.com',
  ]);
});

test('department filter composes with role and search filters', () => {
  assert.deepEqual(filterAndSortAccounts(accounts, 'Employee', '', 'email-asc', 'Logistics').map((account) => account.email), [
    'another.employee@example.com',
  ]);
  assert.deepEqual(filterAndSortAccounts(accounts, 'All', 'employee', 'email-asc', 'TASS').map((account) => account.email), [
    'employee@example.com',
  ]);
});
