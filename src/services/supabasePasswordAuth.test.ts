import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCompanyEmail, validateSupabasePassword } from './supabasePasswordAuth';

test('password authentication accepts only normalized company email addresses', () => {
  assert.equal(normalizeCompanyEmail('  User.Name@MGENESIS.COM '), 'user.name@mgenesis.com');
  assert.throws(() => normalizeCompanyEmail('user@example.com'), /@mgenesis\.com/);
  assert.throws(() => normalizeCompanyEmail('attacker@mgenesis.com.example.org'), /@mgenesis\.com/);
});

test('password creation and recovery share the same minimum length validation', () => {
  assert.equal(validateSupabasePassword('eight888'), 'eight888');
  assert.throws(() => validateSupabasePassword('short'), /at least 8 characters/);
});
