import { PartnerContact, QueuedReportEmail, FeedbackHubSettings } from '../types/feedbackHub';
import {
  loadApplicationRecords,
  persistApplicationRecordsInBackground,
  replaceApplicationRecords,
  upsertApplicationRecords,
} from '../services/applicationRepository';

const CONTACTS_STORAGE_KEY = 'partner_feedback_contacts_v2';
const REPORTS_STORAGE_KEY = 'partner_feedback_sent_reports_v2';
const SETTINGS_STORAGE_KEY = 'partner_feedback_settings_v2';

export const DEFAULT_FEEDBACK_SETTINGS: FeedbackHubSettings = {
  defaultTimerMinutes: 30,
};

export const DEFAULT_SENT_REPORTS: QueuedReportEmail[] = [];

// Local Storage Wrappers
export function getPartnerContacts(): PartnerContact[] {
  try {
    const data = localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading partner contacts', e);
  }
  return [];
}

export function savePartnerContacts(contacts: PartnerContact[]): void {
  try {
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
    persistApplicationRecordsInBackground(
      replaceApplicationRecords('feedback_contact', contacts, (contact) => contact.id),
    );
  } catch (e) {
    console.error('Error saving partner contacts', e);
  }
}

export function getSentReports(): QueuedReportEmail[] {
  try {
    const data = localStorage.getItem(REPORTS_STORAGE_KEY);
    if (data) {
      let reports: QueuedReportEmail[] = JSON.parse(data);
      // Clean up legacy sample reports if they exist.
      const cleaned = reports.filter(r => !['rpt-queued-001', 'rpt-sent-002', 'rpt-returned-003'].includes(r.id));
      if (cleaned.length !== reports.length) {
        localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(cleaned));
      }
      return cleaned;
    }
  } catch (e) {
    console.error('Error reading sent reports', e);
  }
  return DEFAULT_SENT_REPORTS;
}

export function saveSentReports(reports: QueuedReportEmail[]): void {
  try {
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
    persistApplicationRecordsInBackground(
      replaceApplicationRecords('feedback_report', reports, (report) => report.id),
    );
  } catch (e) {
    console.error('Error saving sent reports', e);
  }
}

export function getFeedbackHubSettings(): FeedbackHubSettings {
  try {
    const data = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading feedback settings', e);
  }
  return DEFAULT_FEEDBACK_SETTINGS;
}

export function saveFeedbackHubSettings(settings: FeedbackHubSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    persistApplicationRecordsInBackground(
      upsertApplicationRecords('feedback_settings', [settings], () => 'global'),
    );
  } catch (e) {
    console.error('Error saving feedback settings', e);
  }
}

export async function hydrateFeedbackHubFromSupabase(): Promise<void> {
  const [contacts, reports, settings] = await Promise.all([
    loadApplicationRecords<PartnerContact>('feedback_contact'),
    loadApplicationRecords<QueuedReportEmail>('feedback_report'),
    loadApplicationRecords<FeedbackHubSettings>('feedback_settings'),
  ]);
  if (contacts.length > 0) localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  if (reports.length > 0) localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
  if (settings[0]) localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings[0]));
}
