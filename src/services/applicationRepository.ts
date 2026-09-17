import type { PageModuleKey } from '../utils/rbac';
import type { SurveyResponse, SurveyType } from '../types/survey';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export type ApplicationRecordType =
  | 'partner_company'
  | 'survey'
  | 'survey_response'
  | 'archive_series'
  | 'department_permission'
  | 'category_labels'
  | 'feedback_contact'
  | 'feedback_report'
  | 'feedback_settings'
  | 'document_notification_rule';

export function persistApplicationRecordsInBackground(operation: Promise<void>): void {
  void operation.catch((error) => {
    const message = error instanceof Error ? error.message : 'Unable to save shared data to Supabase.';
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabase-persistence-error', { detail: message }));
    }
  });
}

export interface PersistedProfile {
  email: string;
  role: string;
  designation: string;
  department: string;
  permissions?: {
    pages: PageModuleKey[];
    surveyTypes: SurveyType[];
  };
}

interface ApplicationRecordRow<T> {
  record_id: string;
  payload: T;
}

const WRITE_CHUNK_SIZE = 300;

function requireConfigured(): void {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
}

function assertObjectPayload(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object before it can be saved.`);
  }
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(error?.message ?? 'No authenticated Supabase user.');
  return data.user.id;
}

export function surveyResponseRecordId(response: SurveyResponse): string {
  return `${response.responseId}:${response.questionId}`;
}

export async function loadApplicationRecords<T>(recordType: ApplicationRecordType): Promise<T[]> {
  requireConfigured();
  const values: T[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('application_records')
      .select('record_id,payload')
      .eq('record_type', recordType)
      .order('record_id')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Unable to load ${recordType} records: ${error.message}`);
    const rows = (data ?? []) as unknown as ApplicationRecordRow<T>[];
    for (const row of rows) {
      assertObjectPayload(row.payload, `${recordType}/${row.record_id}`);
      values.push(row.payload);
    }
    if (rows.length < pageSize) break;
  }
  return values;
}

export async function upsertApplicationRecords<T>(
  recordType: ApplicationRecordType,
  values: T[],
  getId: (value: T) => string,
  options?: { ownRecords?: boolean },
): Promise<void> {
  requireConfigured();
  if (values.length === 0) return;
  const ownerId = options?.ownRecords ? await currentUserId() : null;
  const rows = values.map((value) => {
    assertObjectPayload(value, recordType);
    return {
      record_type: recordType,
      record_id: getId(value),
      payload: value,
      ...(ownerId ? { owner_id: ownerId } : {}),
    };
  });

  for (let index = 0; index < rows.length; index += WRITE_CHUNK_SIZE) {
    const { error } = await supabase
      .from('application_records')
      .upsert(rows.slice(index, index + WRITE_CHUNK_SIZE), { onConflict: 'record_type,record_id' });
    if (error) throw new Error(`Unable to save ${recordType} records: ${error.message}`);
  }
}

export async function deleteApplicationRecords(
  recordType: ApplicationRecordType,
  recordIds: string[],
): Promise<void> {
  requireConfigured();
  for (let index = 0; index < recordIds.length; index += WRITE_CHUNK_SIZE) {
    const ids = recordIds.slice(index, index + WRITE_CHUNK_SIZE);
    if (ids.length === 0) continue;
    const { error } = await supabase
      .from('application_records')
      .delete()
      .eq('record_type', recordType)
      .in('record_id', ids);
    if (error) throw new Error(`Unable to delete ${recordType} records: ${error.message}`);
  }
}

export async function replaceApplicationRecords<T>(
  recordType: ApplicationRecordType,
  values: T[],
  getId: (value: T) => string,
): Promise<void> {
  requireConfigured();
  const { data, error } = await supabase
    .from('application_records')
    .select('record_id')
    .eq('record_type', recordType);
  if (error) throw new Error(`Unable to reconcile ${recordType} records: ${error.message}`);
  const nextIds = new Set(values.map(getId));
  const removedIds = (data ?? [])
    .map((row) => row.record_id as string)
    .filter((id) => !nextIds.has(id));
  await upsertApplicationRecords(recordType, values, getId);
  await deleteApplicationRecords(recordType, removedIds);
}

export async function loadProfiles(): Promise<PersistedProfile[]> {
  requireConfigured();
  const { data, error } = await supabase
    .from('app_profiles')
    .select('email,role,designation,department,permission_pages,permission_survey_types')
    .order('email');
  if (error) throw new Error(`Unable to load user profiles: ${error.message}`);
  return (data ?? []).map((row) => ({
    email: row.email,
    role: row.role,
    designation: row.designation,
    department: row.department,
    ...(row.permission_pages || row.permission_survey_types
      ? {
          permissions: {
            pages: (row.permission_pages ?? []) as PageModuleKey[],
            surveyTypes: (row.permission_survey_types ?? []) as SurveyType[],
          },
        }
      : {}),
  }));
}

export async function replaceProfiles(profiles: PersistedProfile[]): Promise<void> {
  requireConfigured();
  const rows = profiles.map((profile) => ({
    email: profile.email.trim().toLowerCase(),
    role: profile.role,
    designation: profile.designation,
    department: profile.department,
    permission_pages: profile.permissions?.pages ?? null,
    permission_survey_types: profile.permissions?.surveyTypes ?? null,
  }));
  const { data, error: loadError } = await supabase.from('app_profiles').select('email');
  if (loadError) throw new Error(`Unable to reconcile user profiles: ${loadError.message}`);
  const nextEmails = new Set(rows.map((row) => row.email));
  const removedEmails = (data ?? []).map((row) => row.email as string).filter((email) => !nextEmails.has(email));
  const { error } = await supabase.from('app_profiles').upsert(rows, { onConflict: 'email' });
  if (error) throw new Error(`Unable to save user profiles: ${error.message}`);
  if (removedEmails.length > 0) {
    const { error: deleteError } = await supabase.from('app_profiles').delete().in('email', removedEmails);
    if (deleteError) throw new Error(`Unable to remove user profiles: ${deleteError.message}`);
  }
}
