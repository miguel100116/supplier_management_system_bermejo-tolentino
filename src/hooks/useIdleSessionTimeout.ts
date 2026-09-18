import { useCallback, useEffect, useRef, useState } from 'react';
import {
  canAutomaticallyRenewSession,
  getIdleSessionState,
  parseSessionActivityTimestamp,
  SESSION_ACTIVITY_STORAGE_PREFIX,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_WARNING_MS,
  sessionActivityStorageKey,
} from '../utils/sessionTimeout';

interface UseIdleSessionTimeoutOptions {
  userEmail: string | null;
  enabled: boolean;
  onTimeout: () => void;
  timeoutMs?: number;
  warningMs?: number;
}

interface IdleSessionTimeoutResult {
  isWarningVisible: boolean;
  remainingMs: number;
  staySignedIn: () => void;
  signOutNow: () => void;
}

const ACTIVITY_WRITE_THROTTLE_MS = 15_000;
const USER_ACTIVITY_EVENTS: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart'];

export function recordSessionActivity(userEmail: string, timestamp = Date.now()): void {
  localStorage.setItem(sessionActivityStorageKey(userEmail), String(timestamp));
}

export function clearSessionActivity(userEmail: string): void {
  localStorage.removeItem(sessionActivityStorageKey(userEmail));
}

export function useIdleSessionTimeout({
  userEmail,
  enabled,
  onTimeout,
  timeoutMs = SESSION_IDLE_TIMEOUT_MS,
  warningMs = SESSION_WARNING_MS,
}: UseIdleSessionTimeoutOptions): IdleSessionTimeoutResult {
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [remainingMs, setRemainingMs] = useState(timeoutMs);
  const lastActivityRef = useRef(Date.now());
  const lastWriteRef = useRef(0);
  const timeoutStartedRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const saveActivity = useCallback((timestamp = Date.now()) => {
    if (!userEmail) return;
    lastActivityRef.current = timestamp;
    lastWriteRef.current = timestamp;
    timeoutStartedRef.current = false;
    recordSessionActivity(userEmail, timestamp);
    setRemainingMs(timeoutMs);
    setIsWarningVisible(false);
  }, [timeoutMs, userEmail]);

  const signOutNow = useCallback(() => {
    if (timeoutStartedRef.current) return;
    timeoutStartedRef.current = true;
    onTimeoutRef.current();
  }, []);

  useEffect(() => {
    if (!enabled || !userEmail) {
      setIsWarningVisible(false);
      setRemainingMs(timeoutMs);
      timeoutStartedRef.current = false;
      return;
    }

    const storageKey = sessionActivityStorageKey(userEmail);
    const storedActivity = parseSessionActivityTimestamp(localStorage.getItem(storageKey));
    if (storedActivity === null) {
      saveActivity();
    } else {
      lastActivityRef.current = storedActivity;
      lastWriteRef.current = storedActivity;
    }

    const evaluate = () => {
      const state = getIdleSessionState(lastActivityRef.current, Date.now(), timeoutMs, warningMs);
      setRemainingMs(state.remainingMs);
      setIsWarningVisible(state.status === 'warning');
      if (state.status === 'expired') signOutNow();
    };

    const handleActivity = (event: Event) => {
      if (!event.isTrusted) return;
      const now = Date.now();
      // Once the warning is visible, require an explicit choice. Otherwise a
      // pointer press on "Sign out now" could renew the session before the
      // button's click event fires, and incidental keyboard input could hide
      // the security warning without the user consenting to continue.
      if (!canAutomaticallyRenewSession(lastActivityRef.current, now, timeoutMs, warningMs)) return;
      if (now - lastWriteRef.current >= ACTIVITY_WRITE_THROTTLE_MS) saveActivity(now);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        const timestamp = parseSessionActivityTimestamp(event.newValue);
        if (timestamp !== null && timestamp > lastActivityRef.current) {
          lastActivityRef.current = timestamp;
          lastWriteRef.current = timestamp;
          timeoutStartedRef.current = false;
        }
        evaluate();
        return;
      }

      // Supabase persists auth state in localStorage. Its removal in another
      // tab is handled by onAuthStateChange; this prefix guard keeps unrelated
      // application storage events out of the idle-session path.
      if (event.key?.startsWith(SESSION_ACTIVITY_STORAGE_PREFIX)) evaluate();
    };

    USER_ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }));
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', evaluate);
    const intervalId = window.setInterval(evaluate, 1000);
    evaluate();

    return () => {
      USER_ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', evaluate);
      window.clearInterval(intervalId);
    };
  }, [enabled, saveActivity, signOutNow, timeoutMs, userEmail, warningMs]);

  return {
    isWarningVisible,
    remainingMs,
    staySignedIn: saveActivity,
    signOutNow,
  };
}
