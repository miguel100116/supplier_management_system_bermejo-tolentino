import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAutomaticallyRenewSession,
  formatSessionTimeRemaining,
  getIdleSessionState,
  parseSessionActivityTimestamp,
  sessionActivityStorageKey,
} from './sessionTimeout';

test('normalizes the account-specific activity storage key', () => {
  assert.equal(
    sessionActivityStorageKey(' Admin@MGENESIS.com '),
    'supplier_management_session_activity_v1:admin@mgenesis.com',
  );
});

test('rejects malformed activity timestamps', () => {
  assert.equal(parseSessionActivityTimestamp(null), null);
  assert.equal(parseSessionActivityTimestamp(''), null);
  assert.equal(parseSessionActivityTimestamp('-1'), null);
  assert.equal(parseSessionActivityTimestamp('not-a-time'), null);
  assert.equal(parseSessionActivityTimestamp('1720000000000'), 1720000000000);
});

test('moves from active to warning to expired at the configured boundaries', () => {
  const startedAt = 1_000_000;
  const timeoutMs = 30 * 60 * 1000;
  const warningMs = 5 * 60 * 1000;
  assert.deepEqual(getIdleSessionState(startedAt, startedAt + 24 * 60 * 1000, timeoutMs, warningMs), {
    status: 'active',
    remainingMs: 6 * 60 * 1000,
  });
  assert.deepEqual(getIdleSessionState(startedAt, startedAt + 25 * 60 * 1000, timeoutMs, warningMs), {
    status: 'warning',
    remainingMs: 5 * 60 * 1000,
  });
  assert.deepEqual(getIdleSessionState(startedAt, startedAt + timeoutMs, timeoutMs, warningMs), {
    status: 'expired',
    remainingMs: 0,
  });
});

test('requires an explicit renewal once the warning period begins', () => {
  const startedAt = 1_000_000;
  const timeoutMs = 30 * 60 * 1000;
  const warningMs = 5 * 60 * 1000;
  assert.equal(canAutomaticallyRenewSession(startedAt, startedAt + 24 * 60 * 1000, timeoutMs, warningMs), true);
  assert.equal(canAutomaticallyRenewSession(startedAt, startedAt + 25 * 60 * 1000, timeoutMs, warningMs), false);
  assert.equal(canAutomaticallyRenewSession(startedAt, startedAt + timeoutMs, timeoutMs, warningMs), false);
});

test('formats the warning countdown without understating partial seconds', () => {
  assert.equal(formatSessionTimeRemaining(300_000), '5:00');
  assert.equal(formatSessionTimeRemaining(60_001), '1:01');
  assert.equal(formatSessionTimeRemaining(0), '0:00');
});
