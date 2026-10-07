import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserPageHistory } from './pageHistory';

test('tracks browser Back and Forward deltas across page entries', () => {
  const history = createBrowserPageHistory();
  const dashboard = history.createState(null, 'dashboard', 'replace');
  const analytics = history.createState(dashboard, 'analytics', 'push');
  const surveyForms = history.createState(analytics, 'survey-forms', 'push');

  assert.equal(history.handlePopState(analytics), -1);
  assert.equal(history.handlePopState(surveyForms), 1);
});

test('ignores the restoring pop after a canceled Back navigation', () => {
  const history = createBrowserPageHistory();
  const fillForm = history.createState(null, 'fill-form', 'replace');
  const analytics = history.createState(fillForm, 'analytics', 'push');

  const backDelta = history.handlePopState(fillForm);
  assert.equal(backDelta, -1);
  assert.equal(history.cancelPopNavigation(backDelta!), 1);
  assert.equal(history.handlePopState(analytics), null);
  assert.equal(history.handlePopState(fillForm), -1);
});

test('does not schedule a browser traversal when the history index did not move', () => {
  const history = createBrowserPageHistory();
  const current = history.createState(null, 'fill-form', 'replace');

  assert.equal(history.handlePopState(current), 0);
  assert.equal(history.cancelPopNavigation(0), null);
});
