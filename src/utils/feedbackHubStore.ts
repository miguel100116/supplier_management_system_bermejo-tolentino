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

export const DEFAULT_PARTNER_CONTACTS: PartnerContact[] = [
  {
    id: 'contact-courier-1',
    companyName: 'LBC Express Inc.',
    partnerType: 'Courier',
    contactPerson: 'Carlos Mendoza (Key Account Lead)',
    email: 'carlos.mendoza@lbc-express.ph',
    ccEmails: ['operations@lbc-express.ph', 'corporate@mgenesis.com'],
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'contact-courier-2',
    companyName: 'Courier Partners Logistics',
    partnerType: 'Courier',
    contactPerson: 'Sarah Jenkins (Account Representative)',
    email: 'sarah.j@courierpartners.com',
    ccEmails: ['dispatch@courierpartners.com'],
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'contact-supplier-1',
    companyName: 'Global Tech Supplies Inc.',
    partnerType: 'Supplier',
    contactPerson: 'Elena Rostova (Client Relations Director)',
    email: 'e.rostova@globaltechsupplies.com',
    ccEmails: ['support@globaltechsupplies.com', 'accounts@mgenesis.com'],
    updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'contact-subcontractor-1',
    companyName: 'Prime Infra Builders Corp.',
    partnerType: 'Subcontractor',
    contactPerson: 'Engr. Manuel Santos (Project Director)',
    email: 'manuel.santos@primeinfra.ph',
    ccEmails: ['contracts@primeinfra.ph'],
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

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
  return DEFAULT_PARTNER_CONTACTS;
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
      // Clean up legacy mocked reports if they exist
      const cleaned = reports.filter(r => !['rpt-queued-001', 'rpt-sent-002', 'rpt-returned-003'].includes(r.id));
      if (cleaned.length !== reports.length) {
        localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(cleaned));
      }
      return autoCheckAndSendExpired(cleaned);
    }
  } catch (e) {
    console.error('Error reading sent reports', e);
  }
  return autoCheckAndSendExpired(DEFAULT_SENT_REPORTS);
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

/** Automatically transitions queued items whose expiresAt <= now() into 'Sent' status */
export function autoCheckAndSendExpired(reports: QueuedReportEmail[]): QueuedReportEmail[] {
  const now = new Date().getTime();
  let changed = false;

  const updated = reports.map((rpt) => {
    if (rpt.status === 'Queued') {
      const expTime = new Date(rpt.expiresAt).getTime();
      if (expTime <= now) {
        changed = true;
        const sentTime = new Date().toISOString();
        return {
          ...rpt,
          status: 'Sent' as const,
          sentAt: sentTime,
          history: [
            ...rpt.history,
            {
              action: 'Auto-Sent' as const,
              timestamp: sentTime,
              actor: 'System Countdown Timer',
              details: 'Queue countdown expired without return; report email automatically sent to partner contact.'
            }
          ]
        };
      }
    }
    return rpt;
  });

  if (changed) {
    try {
      saveSentReports(updated);
    } catch (e) {
      // Ignore
    }
  }

  return updated;
}

export async function hydrateFeedbackHubFromSupabase(): Promise<void> {
  const [contacts, reports, settings] = await Promise.all([
    loadApplicationRecords<PartnerContact>('feedback_contact'),
    loadApplicationRecords<QueuedReportEmail>('feedback_report'),
    loadApplicationRecords<FeedbackHubSettings>('feedback_settings'),
  ]);
  if (contacts.length > 0) localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  if (reports.length > 0) localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(autoCheckAndSendExpired(reports)));
  if (settings[0]) localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings[0]));
}
