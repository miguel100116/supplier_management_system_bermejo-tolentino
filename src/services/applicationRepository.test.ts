import assert from 'node:assert/strict';
import test from 'node:test';
import type { SurveyResponse } from '../types/survey';
import { surveyResponseRecordId } from './applicationRepository';

test('uses the submission and question IDs as the stable response-row key', () => {
  const response = {
    responseId: 'response-1',
    questionId: 'Q-SUP-01',
  } as SurveyResponse;
  assert.equal(surveyResponseRecordId(response), 'response-1:Q-SUP-01');
});
