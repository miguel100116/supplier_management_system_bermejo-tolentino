import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CustomForm } from '../../../types/survey';
import { SurveyFillerPage } from '../../../pages/SurveyFillerPage';
import { getVisibleSurveyForms } from '../domain/surveySelection';

const forms: CustomForm[] = ['Test', 'test 2', 'test 3', 'Test Sept. 23', 'Supplier Quality Evaluation', 'Subcontractor Performance Survey'].map((title, index) => ({ id: String(index), title, surveyType: 'Supplier', description: '', createdAt: '2026-10-02', questions: [] }));

function renderForm(isAdmin: boolean, surveys = forms, profile?: { department: string; designation: string }) {
  const globals = globalThis as typeof globalThis & { React?: typeof React };
  const previous = globals.React;
  globals.React = React;
  try {
    return renderToStaticMarkup(<SurveyFillerPage surveys={getVisibleSurveyForms(surveys, isAdmin)} partnerCompanies={[]} initialSurveyId="1" userEmail="employee@example.com" defaultDepartment={profile?.department} defaultRespondentType={profile?.designation} responses={[]} onSubmitted={() => undefined} onCancel={() => undefined} />);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globals, 'React');
    else globals.React = previous;
  }
}

test('employee New Evaluation removes test options and recovers a previously selected test form', () => {
  const markup = renderForm(false);
  for (const id of ['0', '1', '2', '3']) assert.doesNotMatch(markup, new RegExp(`<option value="${id}"`));
  assert.match(markup, /<option value="4" selected="">Supplier Quality Evaluation/);
  assert.match(markup, /<option value="5">Subcontractor Performance Survey/);
  assert.match(renderForm(true), /<option value="1" selected="">test 2/);
});

test('employees see an account-specific empty state when only test forms exist', () => {
  const markup = renderForm(false, forms.slice(0, 4));
  assert.match(markup, /No Surveys Available/);
  assert.match(markup, /No survey forms are available for your account right now/);
  assert.doesNotMatch(markup, /id="filler-survey"/);
});

test('New Evaluation shows the account department and designation as read-only fields', () => {
  const markup = renderForm(false, forms, { department: 'Procurement Group', designation: 'Managerial' });
  assert.match(markup, /id="filler-dept"[^>]*readonly=""[^>]*value="Procurement Group"/);
  assert.match(markup, /id="filler-role"[^>]*readonly=""[^>]*value="Managerial"/);
  assert.doesNotMatch(markup, /id="filler-dept"[^>]*<option/);
});

test('New Evaluation reflects each account profile independently, including updated Admin assignments', () => {
  const firstAccount = renderForm(false, forms, { department: 'Logistics', designation: 'Rank & File' });
  const secondAccount = renderForm(false, forms, { department: 'TASS', designation: 'Supervisory' });
  assert.match(firstAccount, /id="filler-dept"[^>]*value="Logistics"/);
  assert.match(firstAccount, /id="filler-role"[^>]*value="Rank &amp; File"/);
  assert.match(secondAccount, /id="filler-dept"[^>]*value="TASS"/);
  assert.match(secondAccount, /id="filler-role"[^>]*value="Supervisory"/);
});

test('New Evaluation does not invent organizational information for a missing account profile', () => {
  const markup = renderForm(false);
  assert.match(markup, /id="filler-dept"[^>]*readonly=""[^>]*value="Not assigned"/);
  assert.match(markup, /id="filler-role"[^>]*readonly=""[^>]*value="Not assigned"/);
  assert.match(markup, /id="btn-filler-next"[^>]*disabled=""/);
});

test('SMS-73 respondent-info footer has only the right-aligned proceed action', () => {
  for (const isAdmin of [false, true]) {
    const markup = renderForm(isAdmin);
    const stepOne = markup.slice(markup.indexOf('id="survey-filler-step-1"'), markup.indexOf('</form>'));
    const footer = stepOne.match(/<div class="flex justify-end border-t[^>]*>([\s\S]*)<\/div>$/)?.[1];
    assert.ok(footer, 'respondent-info footer is right aligned');
    assert.equal((footer.match(/<button\b/g) ?? []).length, 1);
    assert.match(footer, /type="submit"/);
    assert.match(footer, /id="btn-filler-next"/);
    assert.match(footer, /Proceed to Form Questions/);
    assert.match(footer, /w-full[^"]*min-\[420px\]:w-auto/);
    assert.doesNotMatch(stepOne, /Back to Form Management/);
    assert.doesNotMatch(footer, /<div\b/);
  }
});

test('SMS-72 removes the top exit button and its empty row before the progress steps', () => {
  for (const isAdmin of [false, true]) {
    const markup = renderForm(isAdmin);
    assert.doesNotMatch(markup, /Back to Form Management/);
    assert.match(markup, /id="survey-filler-container"><div class="flex items-center justify-between gap-2 px-1 sm:px-2">/);
    for (const label of ['Respondent Info', 'Questions Form', 'Success', 'Stakeholder Feedback Form', 'Proceed to Form Questions']) {
      assert.ok(markup.includes(label), `${label} remains visible`);
    }
  }
});
