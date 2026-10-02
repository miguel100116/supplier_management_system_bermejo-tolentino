import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SurveyCalendar } from './SurveyDatePicker';
import { SurveyDateRangeQuestion } from './SurveyDateRangeQuestion';

test('survey calendar provides month/year selection and disables dates before From', () => {
  const markup = renderToStaticMarkup(<SurveyCalendar label="To" displayedDate={new Date(2026, 9, 10)} selectedDate={new Date(2026, 9, 10)} minimumDate={new Date(2026, 9, 10)} focusKey="2026-10-10" onDisplayDate={() => undefined} onSelect={() => undefined} onNavigate={() => undefined} />);
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-label="To month"/);
  assert.match(markup, /aria-label="To year"/);
  const earlier = markup.match(/<button[^>]*aria-label="09\/10\/2026"[^>]*>/)?.[0];
  const sameDay = markup.match(/<button[^>]*aria-label="10\/10\/2026"[^>]*>/)?.[0];
  assert.ok(earlier);
  assert.match(earlier, /disabled=""/);
  assert.ok(sameDay);
  assert.doesNotMatch(sameDay, /disabled=""/);
  assert.match(sameDay, /tabindex="0"/);
});

test('each date question provides labelled typed inputs, calendar icons, required rules, and field errors', () => {
  const markup = renderToStaticMarkup(<SurveyDateRangeQuestion id="duration" value={{ from: '', to: '' }} showErrors onChange={() => undefined} />);
  assert.match(markup, /for="duration-from"/);
  assert.match(markup, /for="duration-to"/);
  assert.equal((markup.match(/placeholder="dd\/mm\/yyyy"/g) ?? []).length, 2);
  assert.equal((markup.match(/aria-required="true"/g) ?? []).length, 2);
  assert.match(markup, /aria-label="Open From calendar"/);
  assert.match(markup, /aria-label="Open To calendar"/);
  assert.equal((markup.match(/This date is required/g) ?? []).length, 2);
  const reversed = renderToStaticMarkup(<SurveyDateRangeQuestion id="duration" value={{ from: '10/10/2026', to: '09/10/2026' }} showErrors onChange={() => undefined} />);
  assert.match(reversed, /id="duration-to-error"/);
  assert.match(reversed, /To date must be on or after From date/);
});
