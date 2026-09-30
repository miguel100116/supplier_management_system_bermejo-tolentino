import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const DOCUMENT_TRACKER_SOURCE = readFileSync(
  new URL('../../../pages/DocumentRegisterPage.tsx', import.meta.url),
  'utf8',
);

test('compliance overview does not repeat the category selected in the filter tabs', () => {
  const overviewHeader = DOCUMENT_TRACKER_SOURCE.match(
    /<div className="flex items-center justify-between">[\s\S]*?<div className="relative" ref=\{customizeRef\}>/,
  )?.[0];

  assert.ok(overviewHeader);
  assert.match(overviewHeader, />Compliance Overview<\/h3>/);
  assert.doesNotMatch(overviewHeader, /\{viewLabel\}/);
  assert.match(DOCUMENT_TRACKER_SOURCE, /<span>\{cat\.label\}<\/span>/);
});
