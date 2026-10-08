import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EvaluationWorkspace, EVALUATION_WORKSPACE_TABS, isEvaluationWorkspacePage } from './EvaluationWorkspace';

test('workspace routes exclude administrative settings, archive, and employee form entry', () => {
  for (const tab of EVALUATION_WORKSPACE_TABS) assert.equal(isEvaluationWorkspacePage(tab.key), true);
  for (const page of ['archive', 'categories-manager', 'import-evaluations', 'fill-form', 'dashboard']) {
    assert.equal(isEvaluationWorkspacePage(page), false);
  }
});

test('each workspace view exposes three navigation choices, one current view, and its content', () => {
  for (const tab of EVALUATION_WORKSPACE_TABS) {
    const html = renderToStaticMarkup(createElement(EvaluationWorkspace, {
      activePage: tab.key,
      onNavigate: () => {},
      children: createElement('p', null, `Content for ${tab.label}`),
    }));
    assert.equal((html.match(/<button/g) ?? []).length, 3);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(html, new RegExp(`aria-current="page"[^>]*>${tab.label}</button>`));
    assert.ok(html.includes('Create and manage evaluation forms, assigned companies, deadlines, and access.'));
    assert.ok(html.includes(`Content for ${tab.label}`));
  }
});
