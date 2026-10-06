import assert from 'node:assert/strict';
import test from 'node:test';
import { generateStrongPassword, validateNewAccountPassword } from './password';
import { parseCreateAccountRequest } from './createAccount';

const profile = { email: '  New.User@MGENESIS.COM ', role: 'Employee', designation: 'Rank & File', department: 'Logistics' };

test('generated passwords have 20 characters, all character groups, and distinct secure values', () => {
  const generated = new Set<string>();
  for (let index = 0; index < 100; index++) {
    const password = generateStrongPassword();
    assert.equal(password.length, 20);
    for (const group of [/[A-Z]/, /[a-z]/, /[0-9]/, /[^a-z0-9]/i]) assert.match(password, group);
    assert.equal(validateNewAccountPassword(password), password);
    generated.add(password);
  }
  assert.equal(generated.size, 100);
});

test('custom passwords allow long passphrases and preserve whitespace without silent truncation', () => {
  assert.equal(validateNewAccountPassword('  a long custom passphrase  '), '  a long custom passphrase  ');
  assert.equal(validateNewAccountPassword('a'.repeat(72)), 'a'.repeat(72));
  assert.throws(() => validateNewAccountPassword('short'), /at least 16/);
  assert.throws(() => validateNewAccountPassword(' '.repeat(20)), /at least 16/);
  assert.throws(() => validateNewAccountPassword('a'.repeat(73)), /72 UTF-8 bytes/);
  assert.throws(() => validateNewAccountPassword('界'.repeat(25)), /72 UTF-8 bytes/);
});

test('provisioning normalizes email and keeps the password outside the profile', () => {
  const request = parseCreateAccountRequest({ profile, password: 'a custom long passphrase' });
  assert.equal(request.profile.email, 'new.user@mgenesis.com');
  assert.equal('password' in request.profile, false);
  assert.equal(request.password, 'a custom long passphrase');
});

test('untrusted creation requests reject invalid domain, role, permissions and unexpected secrets', () => {
  for (const input of [null, [], { ...profile, email: 'user@example.com' }, { ...profile, role: 'Superadmin' },
    { ...profile, email: '@mgenesis.com' }, { ...profile, email: 'one@two@mgenesis.com' },
    { ...profile, permissions: { pages: ['invalid'], surveyTypes: [] } }, { ...profile, password: 'nested secret' }]) {
    assert.throws(() => parseCreateAccountRequest({ profile: input, password: 'a custom long passphrase' }));
  }
  assert.throws(() => parseCreateAccountRequest({ profile, password: 'a custom long passphrase', user_id: 'forged' }));
});
