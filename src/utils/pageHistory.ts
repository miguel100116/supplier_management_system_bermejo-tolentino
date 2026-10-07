import type { PageKey } from './pageRouting';

const PAGE_HISTORY_KEY = '__smsPage';
const PAGE_HISTORY_INDEX_KEY = '__smsPageIndex';

export type PageHistoryMode = 'push' | 'replace';

export interface BrowserPageHistory {
  createState(existingState: unknown, page: PageKey, mode: PageHistoryMode): Record<string, unknown>;
  handlePopState(eventState: unknown): number | null;
  cancelPopNavigation(historyDelta: number): number | null;
}

export function createBrowserPageHistory(initialIndex = 0): BrowserPageHistory {
  let currentIndex = initialIndex;
  let ignoreNextPopState = false;

  return {
    createState(existingState, page, mode) {
      const state = existingState && typeof existingState === 'object'
        ? existingState as Record<string, unknown>
        : {};
      currentIndex = mode === 'push' ? currentIndex + 1 : currentIndex;
      return {
        ...state,
        [PAGE_HISTORY_KEY]: page,
        [PAGE_HISTORY_INDEX_KEY]: currentIndex,
      };
    },

    handlePopState(eventState) {
      const state = eventState && typeof eventState === 'object'
        ? eventState as Record<string, unknown>
        : {};
      const storedIndex = state[PAGE_HISTORY_INDEX_KEY];
      const nextIndex = typeof storedIndex === 'number' ? storedIndex : currentIndex - 1;

      if (ignoreNextPopState) {
        ignoreNextPopState = false;
        currentIndex = nextIndex;
        return null;
      }

      const historyDelta = nextIndex - currentIndex;
      currentIndex = nextIndex;
      return historyDelta;
    },

    cancelPopNavigation(historyDelta) {
      if (historyDelta === 0) return null;
      ignoreNextPopState = true;
      return -historyDelta;
    },
  };
}
