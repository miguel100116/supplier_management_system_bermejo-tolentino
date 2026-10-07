import assert from 'node:assert/strict';
import test from 'node:test';
import { getPageKeyFromPathname, getPagePathname } from './pageRouting';

test('maps module pages to root-relative paths', () => {
  assert.equal(getPagePathname('analytics'), '/analytics');
  assert.equal(getPageKeyFromPathname('/analytics'), 'analytics');
  assert.equal(getPageKeyFromPathname('/'), 'dashboard');
  assert.equal(getPageKeyFromPathname('/dashboard'), 'dashboard');
});

test('supports deployments under a normalized base path', () => {
  assert.equal(getPagePathname('analytics', '/app/'), '/app/analytics');
  assert.equal(getPageKeyFromPathname('/app/analytics', '/app/'), 'analytics');
  assert.equal(getPageKeyFromPathname('/app', '/app'), 'dashboard');
  assert.equal(getPageKeyFromPathname('/app/', '/app'), 'dashboard');
});

test('unknown, nested, and out-of-base paths fall back to dashboard', () => {
  assert.equal(getPageKeyFromPathname('/not-a-module'), 'dashboard');
  assert.equal(getPageKeyFromPathname('/analytics/details'), 'dashboard');
  assert.equal(getPageKeyFromPathname('/elsewhere/analytics', '/app'), 'dashboard');
  assert.equal(getPageKeyFromPathname('/app/unknown', '/app'), 'dashboard');
});
