import assert from 'node:assert/strict';
import test from 'node:test';
import { SurveyResponse } from '../../../types/survey';
import { getAnalyticsCompanyRankings, getCompanyPerformanceRanking, paginateAnalyticsItems, paginateCompanyRankings, rankCompanySummaries } from './rankings';

function courierResponse(company: string, responseId: string, rating: number): SurveyResponse {
  return {
    responseId,
    surveyType: 'Courier',
    respondentType: 'Employee',
    submissionDate: '2026-09-01T00:00:00.000Z',
    company,
    questionId: 'Q01',
    questionNumber: 1,
    question: 'Reliability',
    questionCategory: 'Reliability/Delivery',
    rating,
    comment: '',
  };
}

function supplierResponse(company: string, responseId: string, rating: number): SurveyResponse {
  return {
    ...courierResponse(company, responseId, rating),
    surveyType: 'Supplier',
    questionId: 'Q39',
    questionCategory: 'Documentation',
  };
}

test('pure and weighted company summaries use their respective ranking values', () => {
  const candidates = [
    { name: 'One Review', scorePercentage: 100, count: 1, type: 'Courier' as const },
    { name: 'Established', scorePercentage: 90, count: 20, type: 'Courier' as const },
    { name: 'Peer', scorePercentage: 70, count: 20, type: 'Courier' as const },
  ];

  assert.equal(rankCompanySummaries(candidates, 'pure')[0].name, 'One Review');
  assert.equal(rankCompanySummaries(candidates, 'weighted')[0].name, 'Established');

  const weightedByName = new Map(rankCompanySummaries(candidates, 'weighted').map((item) => [item.name, item.rankScore]));
  assert.ok(Math.abs(weightedByName.get('One Review')! - 83.73983739837398) < 1e-10);
  assert.ok(Math.abs(weightedByName.get('Established')! - 88.09756097560976) < 1e-10);
  assert.ok(Math.abs(weightedByName.get('Peer')! - 72.09756097560975) < 1e-10);
});

test('Analytics uses the respondent-weighted peer average and five-response benchmark', () => {
  // Supplier peer average is (100 × 1 + 90 × 9 + 70 × 10) / 20 = 80.5.
  // The unrelated Courier response must not enter this Supplier peer group.
  const responses = [
    supplierResponse('One Review', 'one-1', 4),
    ...Array.from({ length: 9 }, (_, index) => supplierResponse('Established', `established-${index}`, 3.6)),
    ...Array.from({ length: 10 }, (_, index) => supplierResponse('Peer', `peer-${index}`, 2.8)),
    courierResponse('Other partner type', 'courier-1', 15),
  ];

  const weighted = getAnalyticsCompanyRankings(responses, ['Supplier'], 'weighted');
  const weightedByName = new Map(weighted.map((item) => [item.name, item]));
  assert.equal(weightedByName.get('One Review')?.count, 1);
  assert.equal(weightedByName.get('Established')?.count, 9);
  assert.equal(weightedByName.get('Peer')?.count, 10);
  assert.ok(Math.abs(weightedByName.get('One Review')!.rankScore - 83.75) < 1e-10);
  assert.ok(Math.abs(weightedByName.get('Established')!.rankScore - 86.60714285714286) < 1e-10);
  assert.ok(Math.abs(weightedByName.get('Peer')!.rankScore - 73.5) < 1e-10);

  const pure = getAnalyticsCompanyRankings(responses, ['Supplier'], 'pure');
  const pureByName = new Map(pure.map((item) => [item.name, item.rankScore]));
  assert.equal(pureByName.get('One Review'), 100);
  assert.equal(pureByName.get('Established'), 90);
  assert.equal(pureByName.get('Peer'), 70);
});

test('performance chart ordering and displayed score follow the selected ranking mode', () => {
  const responses = [
    courierResponse('One Review', 'one-1', 15),
    ...Array.from({ length: 20 }, (_, index) => courierResponse('Established', `established-${index}`, 13.5)),
    ...Array.from({ length: 20 }, (_, index) => courierResponse('Peer', `peer-${index}`, 10.5)),
  ];

  const pure = getCompanyPerformanceRanking(responses, ['Courier'], 'pure', 'highest', 3);
  const weighted = getCompanyPerformanceRanking(responses, ['Courier'], 'weighted', 'highest', 3);

  assert.equal(pure[0].company, 'One Review');
  assert.equal(pure[0].score, pure[0].rawScore);
  assert.equal(weighted[0].company, 'Established');
  assert.notEqual(weighted.find((item) => item.company === 'One Review')?.score, 100);
});

test('performance ranking honors active survey types and least-performing direction', () => {
  const supplier: SurveyResponse = {
    ...courierResponse('Supplier Only', 'supplier-1', 4),
    surveyType: 'Supplier',
    questionId: 'Q39',
    questionCategory: 'Documentation',
  };
  const responses = [
    courierResponse('High Courier', 'high-1', 15),
    courierResponse('Low Courier', 'low-1', 7.5),
    supplier,
  ];

  const result = getCompanyPerformanceRanking(responses, ['Courier'], 'pure', 'lowest', 1);
  assert.deepEqual(result.map((item) => item.company), ['Low Courier']);
});

test('company leaderboard pagination returns no more than 20 companies and preserves rank offsets', () => {
  const companies = Array.from({ length: 45 }, (_, index) => `Company ${index + 1}`);

  const secondPage = paginateCompanyRankings(companies, 1);
  assert.equal(secondPage.items.length, 20);
  assert.equal(secondPage.items[0], 'Company 21');
  assert.equal(secondPage.startIndex, 20);
  assert.equal(secondPage.totalPages, 3);

  const clampedPage = paginateCompanyRankings(companies.slice(0, 5), 2);
  assert.equal(clampedPage.currentPage, 0);
  assert.deepEqual(clampedPage.items, companies.slice(0, 5));
});

test('question performance pagination returns no more than 20 ranked questions', () => {
  const questions = Array.from({ length: 41 }, (_, index) => `Question ${index + 1}`);

  const secondPage = paginateAnalyticsItems(questions, 1);
  assert.equal(secondPage.items.length, 20);
  assert.equal(secondPage.items[0], 'Question 21');
  assert.equal(secondPage.startIndex, 20);
  assert.equal(secondPage.totalPages, 3);
});
