import { supabase, isSupabaseConfigured } from '../../../services/supabaseClient';
import { parseCreateAccountRequest } from '../domain/createAccount';
import type { PersistedProfile } from '../domain/accountProfile';

export async function createAccount(profile: PersistedProfile, password: string): Promise<PersistedProfile> {
  if (!isSupabaseConfigured) throw new Error('Supabase must be configured before creating a login.');
  const request = parseCreateAccountRequest({ profile, password });
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Sign in again before creating an account.');
  const response = await fetch('/api/admin/accounts', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(request), cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Account creation is unavailable. Run the application server and retry.');
  }
  const result = payload as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Unable to create the account.');
  const parsed = parseCreateAccountRequest({ profile: result.profile, password });
  // Return only the profile; the password never enters account state or storage.
  return parsed.profile;
}
