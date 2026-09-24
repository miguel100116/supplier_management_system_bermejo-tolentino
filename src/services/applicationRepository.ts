import type { PageModuleKey } from '../utils/rbac';
import type { ComplianceDocument, PartnerCompany, SurveyAccessRole, SurveyResponse, SurveyType } from '../types/survey';
import type { NotificationReadState } from '../utils/notificationReadState';
import {
  createNotificationReadState,
  parseNotificationReadState,
} from '../utils/notificationReadState';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import { parseApplicationRecordPayload } from './applicationRecordSchemas';

export const APPLICATION_RECORD_TYPES = [
  'partner_company',
  'survey',
  'survey_response',
  'archive_series',
  'department_permission',
  'category_labels',
  'feedback_contact',
  'feedback_report',
  'feedback_settings',
  'document_notification_rule',
  'notification_read_state',
  'admin_activity',
  'document_modification',
  'export_history',
  'supplier_ranking_history',
  'employee_notification_state',
  'reminder_settings',
  'compliance_snapshot',
  'active_company_snapshot',
] as const;

export type ApplicationRecordType = typeof APPLICATION_RECORD_TYPES[number];

export const APPLICATION_RECORD_CHANGED_EVENT = 'supabase-application-record-changed';
export const APPLICATION_PROFILES_CHANGED_EVENT = 'supabase-application-profiles-changed';

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
  role: 'Admin' | 'Employee';
  designation: SurveyAccessRole;
  department: typeof PROFILE_DEPARTMENTS[number];
  permissions?: {
    pages: PageModuleKey[];
    surveyTypes: SurveyType[];
  };
}

const PROFILE_ROLES = ['Admin', 'Employee'] as const;
const PROFILE_DESIGNATIONS = ['Rank & File', 'Supervisory', 'Managerial', 'Director', 'Executive'] as const;
const PROFILE_DEPARTMENTS = [
  'Accounts Payable - Trade',
  'Business Solutions Manager',
  'Executive Office',
  'Logistics',
  'Procurement Group',
  'TASS',
] as const;
const PROFILE_PAGE_MODULES = [
  'dashboard',
  'survey-forms',
  'explorer',
  'analytics',
  'reports',
  'present',
  'partner-companies',
  'partners-feedback-hub',
  'account-management',
  'notifications',
  'archive',
  'import-evaluations',
  'document-register',
  'supplier-ranking',
  'renew-documents',
] as const satisfies readonly PageModuleKey[];
const PROFILE_SURVEY_TYPES = ['Courier', 'Supplier', 'Subcontractor'] as const satisfies readonly SurveyType[];

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function parseOptionalEnumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => !isOneOf(item, allowed))) {
    throw new Error(`${label} contains an unsupported value.`);
  }
  return [...new Set(value as T[])];
}

export function parsePersistedProfile(value: unknown, label = 'profile'): PersistedProfile {
  assertObjectPayload(value, label);
  const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : '';
  if (!email.endsWith('@mgenesis.com')) throw new Error(`${label}.email must be an @mgenesis.com address.`);
  if (!isOneOf(value.role, PROFILE_ROLES)) throw new Error(`${label}.role is invalid.`);
  if (!isOneOf(value.designation, PROFILE_DESIGNATIONS)) throw new Error(`${label}.designation is invalid.`);
  if (!isOneOf(value.department, PROFILE_DEPARTMENTS)) throw new Error(`${label}.department is invalid.`);

  const pages = parseOptionalEnumArray(value.permission_pages, PROFILE_PAGE_MODULES, `${label}.permission_pages`);
  const surveyTypes = parseOptionalEnumArray(
    value.permission_survey_types,
    PROFILE_SURVEY_TYPES,
    `${label}.permission_survey_types`,
  );

  return {
    email,
    role: value.role,
    designation: value.designation,
    department: value.department,
    ...(pages || surveyTypes
      ? { permissions: { pages: pages ?? [], surveyTypes: surveyTypes ?? [] } }
      : {}),
  };
}

interface ApplicationRecordRow<T> {
  record_id: string;
  payload: T;
  created_at: string;
}

const WRITE_CHUNK_SIZE = 300;

function requireConfigured(): void {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
}

function requestAuthoritativeRefresh(recordType: ApplicationRecordType): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APPLICATION_RECORD_CHANGED_EVENT, {
    detail: { recordType, reason: 'write-rejected' },
  }));
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
  let invalidCount = 0;
  const invalidReasons = new Map<string, number>();
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('application_records')
      .select('record_id,payload,created_at')
      .eq('record_type', recordType)
      .order('record_id')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Unable to load ${recordType} records: ${error.message}`);
    const rows = (data ?? []) as unknown as ApplicationRecordRow<T>[];
    for (const row of rows) {
      try {
        values.push(parseApplicationRecordPayload(recordType, row.payload, row.record_id, {
          recordCreatedAt: row.created_at,
        }) as T);
      } catch (error) {
        invalidCount += 1;
        const rawReason = error instanceof Error ? error.message : 'unknown validation error';
        const safeReason = rawReason
          .split(`${recordType}/${row.record_id}`).join(recordType)
          .replace(/\s+/g, ' ')
          .slice(0, 180);
        invalidReasons.set(safeReason, (invalidReasons.get(safeReason) ?? 0) + 1);
      }
    }
    if (rows.length < pageSize) break;
  }
  if (invalidCount > 0 && typeof window !== 'undefined') {
    const reasonSummary = [...invalidReasons.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([reason, count]) => `${count}× ${reason}`)
      .join('; ');
    window.dispatchEvent(new CustomEvent('supabase-persistence-error', {
      detail: `${invalidCount} invalid ${recordType} record${invalidCount === 1 ? '' : 's'} were quarantined during refresh.${reasonSummary ? ` ${reasonSummary}` : ''}`,
    }));
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
  let rows: Array<{ record_type: ApplicationRecordType; record_id: string; payload: T; owner_id?: string }>;
  try {
    rows = values.map((value) => {
      const recordId = getId(value);
      const parsed = parseApplicationRecordPayload(recordType, value, recordId) as T;
      return {
        record_type: recordType,
        record_id: recordId,
        payload: parsed,
        ...(ownerId ? { owner_id: ownerId } : {}),
      };
    });
  } catch (error) {
    requestAuthoritativeRefresh(recordType);
    throw error;
  }

  for (let index = 0; index < rows.length; index += WRITE_CHUNK_SIZE) {
    const { error } = await supabase
      .from('application_records')
      .upsert(rows.slice(index, index + WRITE_CHUNK_SIZE), { onConflict: 'record_type,record_id' });
    if (error) {
      requestAuthoritativeRefresh(recordType);
      throw new Error(`Unable to save ${recordType} records: ${error.message}`);
    }
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
    if (error) {
      requestAuthoritativeRefresh(recordType);
      throw new Error(`Unable to delete ${recordType} records: ${error.message}`);
    }
  }
}

export async function replaceApplicationRecords<T>(
  recordType: ApplicationRecordType,
  values: T[],
  getId: (value: T) => string,
  options?: { ownRecords?: boolean },
): Promise<void> {
  requireConfigured();
  const { data, error } = await supabase
    .from('application_records')
    .select('record_id')
    .eq('record_type', recordType);
  if (error) {
    requestAuthoritativeRefresh(recordType);
    throw new Error(`Unable to reconcile ${recordType} records: ${error.message}`);
  }
  const nextIds = new Set(values.map(getId));
  const removedIds = (data ?? [])
    .map((row) => row.record_id as string)
    .filter((id) => !nextIds.has(id));
  await upsertApplicationRecords(recordType, values, getId, options);
  await deleteApplicationRecords(recordType, removedIds);
}

export function subscribeToApplicationChanges(): () => void {
  if (!isSupabaseConfigured || typeof window === 'undefined') return () => undefined;

  const channel = supabase
    .channel(`application-data-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'application_records' },
      (payload) => {
        const row = (payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old) as {
          record_type?: ApplicationRecordType;
        };
        if (!row.record_type) return;
        window.dispatchEvent(new CustomEvent(APPLICATION_RECORD_CHANGED_EVENT, {
          detail: { recordType: row.record_type },
        }));
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_profiles' },
      () => window.dispatchEvent(new Event(APPLICATION_PROFILES_CHANGED_EVENT)),
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        window.dispatchEvent(new CustomEvent('supabase-persistence-error', {
          detail: 'Live Supabase synchronization is temporarily unavailable. Saved data will refresh after reconnecting.',
        }));
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function loadNotificationReadState(userEmail: string): Promise<NotificationReadState | null> {
  requireConfigured();
  const ownerId = await currentUserId();
  const { data, error } = await supabase
    .from('application_records')
    .select('record_id,payload')
    .eq('record_type', 'notification_read_state')
    .eq('record_id', ownerId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load notification read state: ${error.message}`);
  if (!data) return null;
  const parsed = parseNotificationReadState(data.payload, userEmail);
  if (!parsed) throw new Error('The stored notification read state is invalid.');
  return parsed;
}

export async function saveNotificationReadState(state: NotificationReadState): Promise<void> {
  requireConfigured();
  const ownerId = await currentUserId();
  const normalized = createNotificationReadState(state.userEmail, state.readNotificationIds, state.updatedAt);
  const { error } = await supabase.from('application_records').upsert({
    record_type: 'notification_read_state',
    record_id: ownerId,
    payload: normalized,
    owner_id: ownerId,
  }, { onConflict: 'record_type,record_id' });
  if (error) throw new Error(`Unable to save notification read state: ${error.message}`);
}

export async function loadProfiles(): Promise<PersistedProfile[]> {
  requireConfigured();
  const { data, error } = await supabase
    .from('app_profiles')
    .select('email,role,designation,department,permission_pages,permission_survey_types')
    .order('email');
  if (error) throw new Error(`Unable to load user profiles: ${error.message}`);
  return ((data ?? []) as unknown[]).map((row, index) => parsePersistedProfile(row, `app_profiles[${index}]`));
}

export async function renewPartnerDocument(
  companyId: string,
  branchId: string,
  documentName: string,
  expectedDocument: ComplianceDocument,
  nextDocument: Pick<ComplianceDocument, 'provided' | 'expiryDate'>,
): Promise<PartnerCompany> {
  requireConfigured();
  const { data, error } = await supabase.rpc('renew_partner_document', {
    p_company_id: companyId,
    p_branch_id: branchId,
    p_document_name: documentName,
    p_expected_document: expectedDocument,
    p_next_document: nextDocument,
  });
  if (error) {
    requestAuthoritativeRefresh('partner_company');
    throw new Error(`Unable to renew the document: ${error.message}`);
  }
  return parseApplicationRecordPayload('partner_company', data, companyId) as PartnerCompany;
}

export async function replaceProfiles(profiles: PersistedProfile[]): Promise<void> {
  requireConfigured();
  const rows = profiles.map((profile, index) => {
    const parsed = parsePersistedProfile({
      email: profile.email,
      role: profile.role,
      designation: profile.designation,
      department: profile.department,
      permission_pages: profile.permissions?.pages,
      permission_survey_types: profile.permissions?.surveyTypes,
    }, `profiles[${index}]`);
    return {
      email: parsed.email,
      role: parsed.role,
      designation: parsed.designation,
      department: parsed.department,
      permission_pages: parsed.permissions?.pages ?? null,
      permission_survey_types: parsed.permissions?.surveyTypes ?? null,
    };
  });
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
