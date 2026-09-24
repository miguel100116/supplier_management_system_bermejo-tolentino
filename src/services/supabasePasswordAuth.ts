import { supabase, isSupabaseConfigured } from './supabaseClient';

const COMPANY_EMAIL_SUFFIX = '@mgenesis.com';

export function normalizeCompanyEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized.endsWith(COMPANY_EMAIL_SUFFIX)) {
    throw new Error('Use your verified @mgenesis.com email address.');
  }
  return normalized;
}

export function validateSupabasePassword(password: string): string {
  if (password.length < 8) {
    throw new Error('Use a password with at least 8 characters.');
  }
  return password;
}

function requireConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured for this application.');
  }
}

export async function signInWithSupabasePassword(email: string, password: string): Promise<string> {
  requireConfigured();
  const normalizedEmail = normalizeCompanyEmail(email);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) throw error;
  const authenticatedEmail = data.user.email?.trim().toLowerCase();
  if (!authenticatedEmail?.endsWith(COMPANY_EMAIL_SUFFIX)) {
    await supabase.auth.signOut();
    throw new Error('This account is not authorized for the Supplier Management System.');
  }
  return authenticatedEmail;
}

export interface SupabaseSignUpResult {
  email: string;
  signedIn: boolean;
}

export async function signUpWithSupabasePassword(email: string, password: string): Promise<SupabaseSignUpResult> {
  requireConfigured();
  const normalizedEmail = normalizeCompanyEmail(email);
  validateSupabasePassword(password);
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
  });
  if (error) throw error;
  return { email: normalizedEmail, signedIn: Boolean(data.session) };
}

export async function requestSupabasePasswordReset(email: string, redirectTo: string): Promise<void> {
  requireConfigured();
  const normalizedEmail = normalizeCompanyEmail(email);
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
  if (error) throw error;
}

export async function updateSupabasePassword(password: string): Promise<void> {
  requireConfigured();
  validateSupabasePassword(password);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function getSupabaseSessionEmail(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const email = data.session?.user.email?.trim().toLowerCase();
  return email?.endsWith(COMPANY_EMAIL_SUFFIX) ? email : null;
}
