import type { SurveyResponse } from '../../../types/survey';
import { isWithinDateRange } from '../../../utils/tableFilters';

export interface AnalyticsDateRange {
  from: string;
  to: string;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime())
    && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value;
}

export function getAnalyticsDateRangeError({ from, to }: AnalyticsDateRange): string | null {
  if ((from && !isCalendarDate(from)) || (to && !isCalendarDate(to))) {
    return 'Please choose valid calendar dates.';
  }
  if (from && to && from > to) return 'From date must be on or before To date.';
  return null;
}

export function filterCustomAnalyticsResponses(
  responses: SurveyResponse[],
  dateRange: AnalyticsDateRange,
  selectedSeriesIds: string[] = [],
): SurveyResponse[] {
  if (getAnalyticsDateRangeError(dateRange)) return [];
  const seriesIds = new Set(selectedSeriesIds);
  return responses.filter((response) =>
    (!seriesIds.size || (response.seriesId && seriesIds.has(response.seriesId)))
    && isWithinDateRange(response.submissionDate, dateRange.from, dateRange.to),
  );
}
