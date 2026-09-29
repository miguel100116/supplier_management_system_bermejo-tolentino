import assert from 'node:assert/strict';
import test from 'node:test';
import { countRowsByDocumentStatus, matchesDocumentFilter } from './filters';

const rows = [
  [
    { docName: 'AFS', status: 'Current' as const },
    { docName: 'GIS', status: 'Expired' as const },
  ],
  [
    { docName: 'AFS', status: 'Missing' as const },
    { docName: 'GIS', status: 'Current' as const },
  ],
];

test('document status filtering keeps document name and status on the same cell', () => {
  assert.equal(matchesDocumentFilter(rows[0], 'AFS', 'Expired'), false);
  assert.equal(matchesDocumentFilter(rows[0], 'GIS', 'Expired'), true);
  assert.equal(matchesDocumentFilter(rows[0], 'all', 'Expired'), true);
});

test('needs-attention filtering includes missing and expiring documents but excludes current-only rows', () => {
  assert.equal(matchesDocumentFilter(rows[0], 'AFS', 'needs-attention'), false);
  assert.equal(matchesDocumentFilter(rows[1], 'AFS', 'needs-attention'), true);
  assert.equal(matchesDocumentFilter(rows[1], 'GIS', 'needs-attention'), false);
});

test('status counts count matching rows once even when several cells need attention', () => {
  const counts = countRowsByDocumentStatus(rows, 'all');
  assert.equal(counts.all, 2);
  assert.equal(counts['needs-attention'], 2);
  assert.equal(counts.Current, 2);
  assert.equal(counts.Expired, 1);
  assert.equal(counts.Missing, 1);
});
