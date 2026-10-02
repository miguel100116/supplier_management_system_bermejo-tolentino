import assert from 'node:assert/strict';
import test from 'node:test';
import { getVisibleSurveyForms, isTestSurveyTitle, resolveSelectableSurveyId } from './surveySelection';

const forms = ['Test', 'test 2', 'test 3', 'Test Sept. 23', 'Supplier Quality Evaluation', 'Subcontractor Performance Survey'].map((title, index) => ({ id: String(index), title }));

test('SMS-75 test titles are hidden from employees and retained for Admin review', () => {
  assert.deepEqual(getVisibleSurveyForms(forms, false).map((form) => form.title), ['Supplier Quality Evaluation', 'Subcontractor Performance Survey']);
  assert.deepEqual(getVisibleSurveyForms(forms, true), forms);
  assert.equal(forms.length, 6);
});

test('test naming matches case, whitespace, numbered and separated labels without hiding ordinary titles', () => {
  for (const title of [' TEST ', 'Tests', 'Test2', 'test-draft', 'TEST Sept. 23']) assert.equal(isTestSurveyTitle(title), true, title);
  for (const title of ['Latest Supplier Survey', 'Testing Services Evaluation', 'Supplier Quality Evaluation', 'Testimonial Survey', 'Contest Feedback']) assert.equal(isTestSurveyTitle(title), false, title);
});

test('a hidden or deleted initial selection falls back to a selectable form and an empty list remains empty', () => {
  const visible = getVisibleSurveyForms(forms, false);
  assert.equal(resolveSelectableSurveyId(visible, '1'), '4');
  assert.equal(resolveSelectableSurveyId(visible, '5'), '5');
  assert.equal(resolveSelectableSurveyId(visible, 'deleted'), '4');
  assert.equal(resolveSelectableSurveyId([], '1'), '');
  assert.equal(resolveSelectableSurveyId(getVisibleSurveyForms(forms.slice(0, 4), false), '1'), '');
});
