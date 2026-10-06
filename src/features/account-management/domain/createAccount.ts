import { parsePersistedProfile, type PersistedProfile } from './accountProfile';
import { validateNewAccountPassword } from './password';

export interface CreateAccountRequest { profile: PersistedProfile; password: string }

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid account details.');
  return value as Record<string, unknown>;
}

export function parseCreateAccountRequest(value: unknown): CreateAccountRequest {
  const body = record(value);
  if (Object.keys(body).some((key) => !['profile', 'password'].includes(key))) throw new Error('Invalid account details.');
  const input = record(body.profile);
  if (Object.keys(input).some((key) => !['email', 'role', 'designation', 'department', 'permissions'].includes(key))) {
    throw new Error('Invalid account profile.');
  }
  const permissions = input.permissions === undefined ? undefined : record(input.permissions);
  if (permissions && Object.keys(permissions).some((key) => !['pages', 'surveyTypes'].includes(key))) {
    throw new Error('Invalid account permissions.');
  }
  const profile = parsePersistedProfile({
    email: input.email, role: input.role, designation: input.designation, department: input.department,
    permission_pages: permissions?.pages, permission_survey_types: permissions?.surveyTypes,
  });
  if (!/^[^\s@]+@mgenesis\.com$/.test(profile.email)) throw new Error('Use a valid @mgenesis.com email address.');
  return { profile, password: validateNewAccountPassword(body.password) };
}
