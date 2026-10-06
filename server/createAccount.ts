import type { RequestHandler, ErrorRequestHandler } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseCreateAccountRequest } from '../src/features/account-management/domain/createAccount';

export function accountProvisioningClient(env: NodeJS.ProcessEnv): SupabaseClient | null {
  const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) : null;
}

export const accountRequestErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(error?.type === 'entity.too.large' ? 413 : 400).json({ error: 'Invalid account request.' });
};

export function createAccountHandler(client: SupabaseClient | null): RequestHandler {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '')?.[1];
    if (!token) { res.status(401).json({ error: 'Sign in again before creating an account.' }); return; }
    if (!client) {
      res.status(503).json({ error: 'Account creation is unavailable because the server Supabase key is missing. Add SUPABASE_SECRET_KEY to .env.local (or the server environment), then restart the application server.' }); return;
    }
    let createdUserId: string | undefined;
    let createdEmail: string | undefined;
    try {
      const identity = await client.auth.getUser(token);
      const user = identity.data.user;
      if (identity.error || !user?.email_confirmed_at || !user.email?.toLowerCase().endsWith('@mgenesis.com')) {
        res.status(401).json({ error: 'Sign in with your confirmed company account.' }); return;
      }
      const actor = await client.from('app_profiles').select('role,user_id')
        .eq('email', user.email.toLowerCase()).eq('user_id', user.id).maybeSingle();
      if (actor.error) throw new Error('Authorization check failed.');
      if (actor.data?.role !== 'Admin') { res.status(403).json({ error: 'Only an Admin can create accounts.' }); return; }

      let request: ReturnType<typeof parseCreateAccountRequest>;
      try { request = parseCreateAccountRequest(req.body); }
      catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid account details.' }); return;
      }
      const { profile, password } = request;
      const existing = await client.from('app_profiles').select('email').eq('email', profile.email).maybeSingle();
      if (existing.error) throw new Error('Duplicate check failed.');
      if (existing.data) { res.status(409).json({ error: 'An account with this email already exists.' }); return; }

      // Keep sign-in disabled until the requested authorization profile is saved.
      const created = await client.auth.admin.createUser({ email: profile.email, password, email_confirm: false });
      if (created.error || !created.data.user) {
        const duplicate = created.error?.code === 'email_exists' || created.error?.code === 'user_already_exists';
        res.status(duplicate ? 409 : 400).json({ error: duplicate
          ? 'A login with this email already exists. Its password was not changed.'
          : 'Supabase could not create the login. Check the email and hosted password policy, then retry.' }); return;
      }
      createdUserId = created.data.user.id;
      createdEmail = profile.email;
      // The versioned auth trigger creates this row; update only the new user's row.
      const saved = await client.from('app_profiles').update({
        role: profile.role, designation: profile.designation, department: profile.department,
        permission_pages: profile.permissions?.pages ?? null,
        permission_survey_types: profile.permissions?.surveyTypes ?? null,
      }).eq('email', profile.email).eq('user_id', createdUserId).select('email').single();
      if (saved.error || !saved.data) throw new Error('Profile save failed.');
      const confirmed = await client.auth.admin.updateUserById(createdUserId, { email_confirm: true });
      if (confirmed.error) throw new Error('Login activation failed.');
      res.status(201).json({ profile });
    } catch {
      if (createdUserId && createdEmail) {
        try {
          const removed = await client.auth.admin.deleteUser(createdUserId);
          if (removed.error) throw new Error('Login rollback failed.');
          // ON DELETE SET NULL leaves the trigger-created profile behind.
          const cleaned = await client.from('app_profiles').delete().eq('email', createdEmail).is('user_id', null);
          if (cleaned.error) throw new Error('Profile rollback failed.');
        } catch {
          res.status(500).json({ error: 'Account creation was incomplete. Ask the identity administrator to reconcile the login and profile before retrying.' }); return;
        }
      }
      res.status(502).json({ error: 'Unable to create the account. No completed account was added; retry or contact the administrator.' });
    }
  };
}
