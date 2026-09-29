import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuestionPerformanceRow } from './QuestionPerformanceRow';

const COMPANY_ANALYSIS_SOURCE = readFileSync(
  new URL('../../../components/CompanyAnalysisPanel.tsx', import.meta.url),
  'utf8',
);

test('partner type selector keeps its original buttons responsive without truncating labels', () => {
  assert.match(COMPANY_ANALYSIS_SOURCE, /segmented-control w-full max-w-full lg:w-auto/);
  assert.match(COMPANY_ANALYSIS_SOURCE, /min-w-max py-2 text-center w-full flex-1/);
  assert.match(COMPANY_ANALYSIS_SOURCE, /\{surveyTypeDisplayLabel\[type\]\}/);
  assert.doesNotMatch(COMPANY_ANALYSIS_SOURCE, /lg:w-\[23rem\]/);
});

test('question performance row wraps text and keeps its score bar in separate flow', () => {
  const question = 'A long evaluation question that needs more than one line to remain readable';
  const markup = renderToStaticMarkup(
    <QuestionPerformanceRow rank={39} question={question} average={84.5} />,
  );

  assert.match(markup, /whitespace-normal break-words/);
  assert.doesNotMatch(markup, /\btruncate\b/);
  assert.match(markup, /mt-2 block h-1\.5/);
  assert.match(markup, /role="progressbar"/);
  assert.match(markup, /aria-valuenow="84\.5"/);
  assert.match(markup, new RegExp(question));
});
