import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PasswordInput } from './PasswordInput';

test('password input is concealed by default and exposes an accessible visibility control', () => {
  const markup = renderToStaticMarkup(
    <PasswordInput id="test-password" autoComplete="current-password" required />,
  );

  assert.match(markup, /type="password"/);
  assert.match(markup, /autoComplete="current-password"/);
  assert.match(markup, /aria-label="Show password"/);
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /type="button"/);
});
