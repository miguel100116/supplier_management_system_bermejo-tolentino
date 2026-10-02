import assert from 'node:assert/strict';
import test from 'node:test';
import type { CustomForm, SurveyResponse } from '../../../types/survey';
import { buildSurveyResponseExport, filterSurveySubmissions, groupSurveySubmissions, selectSurveyResponses, surveyResponseFilename } from './surveyResponses';

const survey: CustomForm = {
  id: 'survey-a', title: 'Supplier / Fall: 2026', description: '', surveyType: 'Supplier', createdAt: '2026-10-01',
  questions: [
    { questionId: 'Q39', questionNumber: 1, question: 'Quality', questionCategory: 'Quality' },
    { questionId: 'NOTE', questionNumber: 2, question: 'Comments', questionCategory: 'Comments', inputType: 'text' },
  ],
};
const otherSurvey: CustomForm = { ...survey, id: 'survey-b', questions: [survey.questions[0]] };
const answer = (overrides: Partial<SurveyResponse> = {}): SurveyResponse => ({
  responseId: 'submission-1', surveyId: survey.id, surveyType: 'Supplier', respondentType: 'Employee',
  submissionDate: '2026-10-01T11:00:00Z', company: 'Supplier One', department: 'Purchasing',
  questionId: 'Q39', questionNumber: 1, question: 'Quality', questionCategory: 'Quality',
  rating: 2, comment: '', respondentEmail: 'Person@Example.com', ...overrides,
});

test('SMS-63 matches explicit survey IDs and only unambiguous legacy question IDs', () => {
  const rows = [
    answer(), answer({ surveyId: 'survey-b', responseId: 'other' }),
    answer({ surveyId: undefined, responseId: 'legacy-shared' }),
    answer({ surveyId: undefined, responseId: 'legacy-unique', questionId: 'NOTE' }),
    answer({ surveyId: undefined, responseId: 'legacy-unique', questionId: 'Q39' }),
    answer({ surveyId: undefined, responseId: 'wrong-type', surveyType: 'Courier', questionId: 'NOTE' }),
  ];
  assert.deepEqual(selectSurveyResponses(survey, [survey, otherSurvey], rows).map((row) => row.responseId), ['submission-1', 'legacy-unique', 'legacy-unique']);
});

test('SMS-63 lists and filters submissions, then exports one row per submission', () => {
  const rows = [
    answer(),
    answer({ questionId: 'NOTE', questionNumber: 2, question: 'Comments', questionCategory: 'Comments', rating: 'N/A', comment: 'On time' }),
    answer({ responseId: 'submission-2', respondentEmail: 'another@example.com', submissionDate: '2026-10-02T10:00:00Z', rating: 'N/A' }),
  ];
  const groups = groupSurveySubmissions(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].id, 'submission-2');
  assert.equal(groups[0].score, null);
  assert.equal(groups[1].score, 50);
  const filtered = filterSurveySubmissions(groups, ' PERSON@EXAMPLE ');
  assert.equal(filtered.length, 1);
  const all = buildSurveyResponseExport(survey, groups);
  assert.equal(all.rows.length, 2);
  assert.equal(all.columns.length, 7);
  assert.deepEqual(all.rows[1], ['Person@Example.com', 'Purchasing', 'Supplier One', '2026-10-01T11:00:00Z', 50, 2, 'On time']);
  assert.equal(buildSurveyResponseExport(survey, filtered).rows.length, 1);
  assert.equal(surveyResponseFilename(survey.title, new Date('2026-10-02T00:00:00Z')), 'Supplier_Fall_2026_responses_2026-10-02.xlsx');
});
