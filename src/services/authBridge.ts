// Bridges a Microsoft (Entra ID) sign-in into a real Supabase Auth session.
//
// Why this exists: the app authenticates the user with MSAL in the browser,
// but the *data* lives in Supabase, where Row Level Security is the real
// access-control boundary. RLS can only enforce anything if Supabase knows
// who the caller is - i.e. if there is a Supabase session whose JWT carries
// the user's email. This module exchanges the Microsoft ID token for exactly
// that session.
//
// PREREQUISITE (one-time, in the Supabase dashboard):
//   Authentication > Providers > Azure  -> enable it, and add the Entra app's
//   Application (client) ID to the provider's allowed audiences. Without that,
//   signInWithIdToken below returns an "provider not enabled"/audience error
//   and Microsoft sign-in is blocked because an MSAL-only identity cannot be
//   authorized by Postgres RLS. See supabase/seed_admins.sql for role setup.

import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface SupabaseBridgeResult {
  ok: boolean;
  error?: string;
}

// Exchange the Microsoft ID token for a Supabase session. Callers must treat
// failure as a blocking authentication error because Postgres RLS cannot
// authorize an MSAL-only browser identity.
export async function signIntoSupabaseWithMicrosoft(
  idToken: string,
  nonce: string,
): Promise<SupabaseBridgeResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured (VITE_SUPABASE_* missing).' };
  }
  try {
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'azure',
      token: idToken,
      nonce,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown Supabase sign-in error.' };
  }
}

// True if there is a live Supabase session right now. supabase-js persists
// its own session, so this survives reloads without re-bridging.
export async function hasSupabaseSession(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

export async function signOutSupabase(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.auth.signOut();
  } catch {
    // Signing out of the local app must succeed even if the network call fails.
  }
}
