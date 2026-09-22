// Dedicated audit trail for the Supplier Ranking page - who changed the Top
// 20 evaluation pool, when, and a full snapshot of what the 20 slots looked
// like immediately after that save (so a later change can always be traced
// back to exactly what it replaced). Separate from adminActivityLog.ts,
// which only stores a flat text blurb - this needs structured, replayable
// snapshot data for the "view what the ranking looked like at this point"
// feature.

export interface RankingSnapshotSlot {
  rank: number; // 1-20
  companyId?: string;
  companyName?: string; // denormalized so history reads correctly even if the company is later renamed/archived
}

export interface RankingLogEntry {
  id: string;
  actorEmail: string;
  timestamp: string;
  changedCount: number;
  snapshot: RankingSnapshotSlot[]; // full 20-slot state as of this save
}

const STORAGE_KEY = 'survey_supplier_ranking_log_v1';
const MIGRATION_KEY = 'survey_supplier_ranking_log_supabase_migrated_v1';
const HISTORY_LIMIT = 100;

export function logRankingChange(actorEmail: string, snapshot: RankingSnapshotSlot[], changedCount: number): RankingLogEntry {
  const entry: RankingLogEntry = {
    id: `RANK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actorEmail: actorEmail || 'unknown',
    timestamp: new Date().toISOString(),
    changedCount,
    snapshot,
  };
  try {
    const existing = getRankingLog();
    const updated = [entry, ...existing].slice(0, HISTORY_LIMIT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    persistApplicationRecordsInBackground(
      upsertApplicationRecords('supplier_ranking_history', [entry], (item) => item.id),
    );
  } catch (e) {
    // Best-effort logging only - a storage failure shouldn't block the save itself.
  }
  return entry;
}

export async function hydrateSupplierRankingLogFromSupabase(): Promise<void> {
  let entries = await loadApplicationRecords<RankingLogEntry>('supplier_ranking_history');
  if (entries.length === 0 && localStorage.getItem(MIGRATION_KEY) !== 'true') {
    entries = getRankingLog();
    if (entries.length > 0) {
      await upsertApplicationRecords('supplier_ranking_history', entries, (entry) => entry.id);
    }
  }
  const ordered = entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, HISTORY_LIMIT);
  localStorage.setItem(MIGRATION_KEY, 'true');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered));
  window.dispatchEvent(new Event('supplier-ranking-history-updated'));
}

export function getRankingLog(): RankingLogEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}
import {
  loadApplicationRecords,
  persistApplicationRecordsInBackground,
  upsertApplicationRecords,
} from '../services/applicationRepository';
