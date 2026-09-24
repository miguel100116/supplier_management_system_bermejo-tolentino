import assert from 'node:assert/strict';
import test from 'node:test';
import type { SurveyResponse, SurveyType } from '../types/survey';
import { commitRawEvaluationImport, type RawEvalPreview } from './rawEvaluationImport';
import { getLeaderboard, getPureAverageLeaderboard } from './scoring';

const scoredQuestion: Record<SurveyType, { id: string; max: number; category: string }> = {
  Courier: { id: 'Q01', max: 15, category: 'Reliability/Delivery' },
  Supplier: { id: 'Q39', max: 4, category: 'Documentation' },
  Subcontractor: { id: 'Q03', max: 2, category: 'Delivery / Timeliness' },
};

function response(
  surveyType: SurveyType,
  company: string,
  companyId: string,
  responseId: string,
  fraction: number,
  submissionDate = '2026-09-01T00:00:00.000Z',
): SurveyResponse {
  const question = scoredQuestion[surveyType];
  return {
    responseId,
    companyId,
    surveyType,
    respondentType: 'Employee',
    submissionDate,
    company,
    questionId: question.id,
    questionNumber: 1,
    question: 'Scored criterion',
    questionCategory: question.category,
    rating: question.max * fraction,
    comment: '',
  };
}

for (const surveyType of ['Courier', 'Supplier', 'Subcontractor'] as const) {
  test(`${surveyType} leaderboard recalculates and re-sorts after new evaluation data`, () => {
    const initial = [
      response(surveyType, 'Company A', `${surveyType}-a`, `${surveyType}-a-1`, 0.8),
      response(surveyType, 'Company B', `${surveyType}-b`, `${surveyType}-b-1`, 0.6),
    ];

    assert.equal(getPureAverageLeaderboard(initial, surveyType)[0].company, 'Company A');
    assert.equal(getLeaderboard(initial, surveyType)[0].company, 'Company A');

    const updated = [
      ...initial,
      ...Array.from({ length: 4 }, (_, index) => response(
        surveyType,
        'Company B',
        `${surveyType}-b`,
        `${surveyType}-b-${index + 2}`,
        1,
      )),
    ];

    const pure = getPureAverageLeaderboard(updated, surveyType);
    const weighted = getLeaderboard(updated, surveyType);
    assert.equal(pure[0].company, 'Company B');
    assert.equal(weighted[0].company, 'Company B');
    assert.equal(pure[0].evaluationCount, 5);
    assert.equal(pure[0].compositeScore, 92);
  });
}

test('stable company IDs keep renamed evaluations in one leaderboard entry', () => {
  const responses = [
    response('Supplier', 'Old Display Name', 'supplier-1', 'old-response', 0.5, '2026-01-01T00:00:00.000Z'),
    response('Supplier', 'Current Display Name', 'supplier-1', 'new-response', 1, '2026-09-01T00:00:00.000Z'),
  ];

  const leaderboard = getPureAverageLeaderboard(responses, 'Supplier');
  assert.equal(leaderboard.length, 1);
  assert.equal(leaderboard[0].companyId, 'supplier-1');
  assert.equal(leaderboard[0].company, 'Current Display Name');
  assert.equal(leaderboard[0].evaluationCount, 2);
  assert.equal(leaderboard[0].compositeScore, 75);
});

test('an unambiguous legacy name without an ID joins the matching company group', () => {
  const legacy = response('Courier', 'Courier Company', 'unused', 'legacy-response', 0.5);
  delete legacy.companyId;
  const responses = [
    legacy,
    response('Courier', 'Courier Company', 'courier-1', 'current-response', 1),
  ];

  const leaderboard = getPureAverageLeaderboard(responses, 'Courier');
  assert.equal(leaderboard.length, 1);
  assert.equal(leaderboard[0].companyId, 'courier-1');
  assert.equal(leaderboard[0].evaluationCount, 2);
  assert.equal(leaderboard[0].compositeScore, 75);
});

test('CSV import responses retain the company ID resolved from the partner registry', () => {
  const cells = Array.from({ length: 26 }, () => '');
  cells[9] = 15;
  const preview = {
    surveyType: 'Courier',
    fileName: 'courier.csv',
    importBatchId: 'client-csv:courier:test-hash',
    totalRows: 1,
    skippedBlank: 0,
    missingRespondentInfo: 0,
    companyMatches: [{
      rawName: 'Courier Co.',
      normalizedName: 'COURIER',
      status: 'matched',
      companyId: 'courier-1',
      canonicalName: 'Courier Company',
    }],
    rows: [{
      cells,
      rawCompany: 'Courier Co.',
      normalizedCompany: 'COURIER',
      responseId: 'IMPORT-COURIER-1',
      submissionDate: '2026-09-01T00:00:00.000Z',
      respondentType: 'Employee',
      department: 'Operations',
    }],
  } as unknown as RawEvalPreview;

  const result = commitRawEvaluationImport(preview);
  assert.ok(result.responses.length > 0);
  assert.ok(result.responses.every((item) => item.companyId === 'courier-1'));
  assert.ok(result.responses.every((item) => item.company === 'Courier Company'));
  assert.ok(result.responses.every((item) => item.dataSource === 'client_csv'));
  assert.ok(result.responses.every((item) => item.importBatchId === preview.importBatchId));
});
