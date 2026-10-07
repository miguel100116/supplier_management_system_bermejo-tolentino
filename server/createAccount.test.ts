import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { accountProvisioningClient, accountRequestErrorHandler, createAccountHandler } from './createAccount';

const actorId = '11111111-1111-4111-8111-111111111111';
const newId = '22222222-2222-4222-8222-222222222222';
const profile = { email: 'new.user@mgenesis.com', role: 'Employee', designation: 'Supervisory', department: 'TASS',
  permissions: { pages: ['dashboard'], surveyTypes: ['Supplier'] } };
const body = { profile, password: 'synthetic-test-password-123!' };
interface Options { role?: string; invalidToken?: boolean; unconfirmed?: boolean; duplicate?: boolean;
  authDuplicate?: boolean; profileFail?: boolean; confirmFail?: boolean; rollbackFail?: boolean; unconfigured?: boolean }

async function request(options: Options = {}, input: unknown = body, token: string | null = 'synthetic-token') {
  const operations: string[] = [];
  let authInput: Record<string, unknown> | undefined;
  let profileInput: Record<string, unknown> | undefined;
  const user = (id: string, email: string) => ({ id, email, aud: 'authenticated', role: 'authenticated',
    email_confirmed_at: options.unconfirmed ? null : '2026-10-01T00:00:00Z',
    created_at: '2026-10-01T00:00:00Z', app_metadata: {}, user_metadata: {} });
  const result = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const client = createClient('https://synthetic.supabase.co', 'synthetic-server-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, init) => {
      const target = new URL(String(url));
      const method = init?.method || 'GET';
      if (target.pathname === '/auth/v1/user') {
        operations.push('verify-token');
        return options.invalidToken ? result({ message: 'Invalid token' }, 401) : result(user(actorId, 'admin@mgenesis.com'));
      }
      if (target.pathname === '/auth/v1/admin/users' && method === 'POST') {
        operations.push('create-login');
        authInput = JSON.parse(String(init?.body));
        return options.authDuplicate ? result({ error_code: 'email_exists', message: 'duplicate' }, 422) : result(user(newId, profile.email));
      }
      if (target.pathname === `/auth/v1/admin/users/${newId}`) {
        if (method === 'DELETE') {
          operations.push('delete-login');
          return options.rollbackFail ? result({ message: 'rollback failed' }, 500) : result(user(newId, profile.email));
        }
        operations.push('activate-login');
        return options.confirmFail ? result({ message: 'activation failed' }, 500) : result(user(newId, profile.email));
      }
      if (target.pathname === '/rest/v1/app_profiles') {
        if (method === 'PATCH') {
          operations.push('save-profile');
          profileInput = JSON.parse(String(init?.body));
          return options.profileFail ? result({ message: 'profile save failed' }, 500) : result({ email: profile.email });
        }
        if (method === 'DELETE') { operations.push('delete-profile'); return new Response(null, { status: 204 }); }
        if (target.searchParams.get('select') === 'role,user_id') {
          operations.push('authorize-admin');
          assert.equal(target.searchParams.get('user_id'), `eq.${actorId}`);
          return result({ role: options.role ?? 'Admin', user_id: actorId });
        }
        operations.push('check-duplicate');
        return result(options.duplicate ? { email: profile.email } : null);
      }
      throw new Error('Unexpected provider request.');
    } },
  });
  const app = express();
  app.post('/api/admin/accounts', express.json({ limit: '8kb' }), createAccountHandler(options.unconfigured ? null : client));
  app.use('/api/admin/accounts', accountRequestErrorHandler);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/accounts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: typeof input === 'string' ? input : JSON.stringify(input),
    });
    return { status: response.status, cache: response.headers.get('cache-control'), data: await response.json(), operations, authInput, profileInput };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('Admin provisioning creates a login and exact permissions without returning or storing passwords', async () => {
  const result = await request();
  assert.equal(result.status, 201);
  assert.deepEqual(result.operations, ['verify-token', 'authorize-admin', 'check-duplicate', 'create-login', 'save-profile', 'activate-login']);
  assert.equal(result.authInput?.password, body.password);
  assert.equal(result.authInput?.email_confirm, false);
  assert.deepEqual(result.data, { profile });
  assert.deepEqual(result.profileInput?.permission_pages, ['dashboard']);
  assert.deepEqual(result.profileInput?.permission_survey_types, ['Supplier']);
  assert.equal('password' in (result.profileInput ?? {}), false);
  assert.equal(JSON.stringify(result.data).includes(body.password), false);
  assert.equal(result.cache, 'no-store');
});

test('missing, expired, unconfirmed and Employee identities cannot provision accounts', async () => {
  for (const [options, token, status] of [
    [{}, null, 401], [{ invalidToken: true }, 'invalid', 401], [{ unconfirmed: true }, 'synthetic-token', 401],
    [{ role: 'Employee' }, 'synthetic-token', 403],
  ] as const) {
    const result = await request(options, body, token);
    assert.equal(result.status, status);
    assert.equal(result.operations.includes('create-login'), false);
  }
});

test('invalid request fields and weak passwords are rejected before any write', async () => {
  for (const input of [{ ...body, password: 'weak' }, { ...body, role: 'Admin' }, { ...body, profile: { ...profile, role: 'Invalid' } }]) {
    const result = await request({}, input);
    assert.equal(result.status, 400);
    assert.equal(result.operations.includes('create-login'), false);
  }
});

test('duplicate profiles and logins are rejected without modifying existing credentials', async () => {
  for (const options of [{ duplicate: true }, { authDuplicate: true }]) {
    const result = await request(options);
    assert.equal(result.status, 409);
    assert.equal(result.operations.includes('save-profile'), false);
    assert.equal(result.operations.includes('activate-login'), false);
    assert.equal(result.operations.includes('delete-login'), false);
  }
});

test('profile and activation failures roll back only the new login and its orphan profile', async () => {
  for (const options of [{ profileFail: true }, { confirmFail: true }]) {
    const result = await request(options);
    assert.equal(result.status, 502);
    assert.deepEqual(result.operations.slice(-2), ['delete-login', 'delete-profile']);
    assert.equal(JSON.stringify(result.data).includes(body.password), false);
  }
});

test('failed rollback reports incomplete provisioning instead of success', async () => {
  const result = await request({ profileFail: true, rollbackFail: true });
  assert.equal(result.status, 500);
  assert.match(result.data.error, /reconcile/);
  assert.equal(result.operations.includes('delete-profile'), false);
});

test('unconfigured backend fails clearly without provider requests', async () => {
  assert.equal(accountProvisioningClient({}), null);
  const result = await request({ unconfigured: true });
  assert.equal(result.status, 503);
  assert.deepEqual(result.operations, []);
});

test('malformed JSON and oversized bodies do not expose password contents in parser errors', async () => {
  for (const input of ['{"password":"synthetic-sensitive-text",', JSON.stringify({ password: 'synthetic-sensitive-text'.repeat(500) })]) {
    const result = await request({}, input);
    assert.ok(result.status === 400 || result.status === 413);
    assert.equal(JSON.stringify(result.data).includes('synthetic-sensitive-text'), false);
    assert.deepEqual(result.operations, []);
  }
});
