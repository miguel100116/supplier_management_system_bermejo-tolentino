import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { scrollDocumentMatrixWithArrowKey } from './documentMatrixKeyboard';

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

test('document matrix arrow keys scroll horizontally and leave other keys alone', () => {
  const calls: ScrollToOptions[] = [];
  const surface = { scrollBy: (options: ScrollToOptions) => calls.push(options) };

  assert.equal(scrollDocumentMatrixWithArrowKey(surface, 'ArrowRight'), true);
  assert.equal(scrollDocumentMatrixWithArrowKey(surface, 'ArrowLeft'), true);
  assert.equal(scrollDocumentMatrixWithArrowKey(surface, 'ArrowDown'), false);
  assert.deepEqual(calls, [
    { left: 160, behavior: 'smooth' },
    { left: -160, behavior: 'smooth' },
  ]);
});

test('document matrix is keyboard-focusable and preserves arrow keys in form controls', () => {
  assert.match(DOCUMENT_TRACKER_SOURCE, /aria-label="Partner compliance document matrix[^"]*"/);
  assert.match(DOCUMENT_TRACKER_SOURCE, /tabIndex=\{0\}[\s\S]*?onKeyDown=\{handleMatrixKeyDown\}/);
  assert.match(DOCUMENT_TRACKER_SOURCE, /input, select, textarea, \[contenteditable="true"\]/);
  assert.match(DOCUMENT_TRACKER_SOURCE, /onKeyDown=\{handleMatrixKeyDown\}/);
});
