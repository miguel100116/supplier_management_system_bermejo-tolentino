const EVENT_NAME = 'survey-reminders-changed';

function storageKey(userEmail: string, kind: 'read' | 'deleted') {
  return `survey_reminders_${kind}_${userEmail.trim().toLowerCase()}`;
}

function loadIds(userEmail: string, kind: 'read' | 'deleted'): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userEmail, kind));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    return new Set();
  }
}

function saveIds(userEmail: string, kind: 'read' | 'deleted', ids: Set<string>) {
  localStorage.setItem(storageKey(userEmail, kind), JSON.stringify(Array.from(ids)));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function getReadIds(userEmail: string): Set<string> {
  return loadIds(userEmail, 'read');
}

export function getDeletedIds(userEmail: string): Set<string> {
  return loadIds(userEmail, 'deleted');
}

export function markNotificationRead(userEmail: string, id: string) {
  const ids = loadIds(userEmail, 'read');
  if (!ids.has(id)) {
    ids.add(id);
    saveIds(userEmail, 'read', ids);
  }
}

export function markNotificationUnread(userEmail: string, id: string) {
  const ids = loadIds(userEmail, 'read');
  if (ids.delete(id)) saveIds(userEmail, 'read', ids);
}

export function markNotificationsRead(userEmail: string, notificationIds: string[]) {
  if (notificationIds.length === 0) return;
  const ids = loadIds(userEmail, 'read');
  let changed = false;
  notificationIds.forEach((id) => {
    if (!ids.has(id)) {
      ids.add(id);
      changed = true;
    }
  });
  if (changed) saveIds(userEmail, 'read', ids);
}

export function deleteNotifications(userEmail: string, idsToDelete: string[]) {
  if (idsToDelete.length === 0) return;
  const ids = loadIds(userEmail, 'deleted');
  idsToDelete.forEach((id) => ids.add(id));
  saveIds(userEmail, 'deleted', ids);
}

/** Subscribe to read/deleted state changes made anywhere in the app (bell, page, etc). */
export function subscribeNotificationState(callback: () => void) {
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}
