import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewAccountPasswordField } from './NewAccountPasswordField';

test('new account password is editable, concealed, labeled and offers generation and copy', () => {
  const html = renderToStaticMarkup(<NewAccountPasswordField value="example-password-for-tests" onChange={() => {}} onGenerate={() => {}} disabled={false} />);
  assert.match(html, /type="password"/);
  assert.match(html, /autoComplete="new-password"/);
  assert.match(html, /for="new-account-password"/);
  assert.match(html, /Show password/);
  assert.match(html, /Generate Strong Password/);
  assert.match(html, /Copy Password/);
  assert.match(html, /minLength="16"/);
  assert.doesNotMatch(html, /readonly/i);
});

test('password controls disable during account provisioning', () => {
  const html = renderToStaticMarkup(<NewAccountPasswordField value="example-password-for-tests" onChange={() => {}} onGenerate={() => {}} disabled />);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 3);
});
