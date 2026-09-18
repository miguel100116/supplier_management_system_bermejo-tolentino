export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_WARNING_MS = 5 * 60 * 1000;
export const SESSION_ACTIVITY_STORAGE_PREFIX = 'supplier_management_session_activity_v1:';

export type IdleSessionStatus = 'active' | 'warning' | 'expired';

export interface IdleSessionState {
  status: IdleSessionStatus;
  remainingMs: number;
}

export function sessionActivityStorageKey(userEmail: string): string {
  return `${SESSION_ACTIVITY_STORAGE_PREFIX}${userEmail.trim().toLowerCase()}`;
}

export function parseSessionActivityTimestamp(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getIdleSessionState(
  lastActivityAt: number,
  now: number,
  timeoutMs = SESSION_IDLE_TIMEOUT_MS,
  warningMs = SESSION_WARNING_MS,
): IdleSessionState {
  const elapsedMs = Math.max(0, now - lastActivityAt);
  const remainingMs = Math.max(0, timeoutMs - elapsedMs);
  if (remainingMs === 0) return { status: 'expired', remainingMs };
  if (remainingMs <= warningMs) return { status: 'warning', remainingMs };
  return { status: 'active', remainingMs };
}

export function canAutomaticallyRenewSession(
  lastActivityAt: number,
  now: number,
  timeoutMs = SESSION_IDLE_TIMEOUT_MS,
  warningMs = SESSION_WARNING_MS,
): boolean {
  return getIdleSessionState(lastActivityAt, now, timeoutMs, warningMs).status === 'active';
}

export function formatSessionTimeRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
