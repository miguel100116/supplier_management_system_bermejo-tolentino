import { getDDMMYYYYError, parseDDMMYYYY } from '../../../utils/time';

export interface SurveyDateRange { from: string; to: string }
export interface SurveyDateRangeErrors { from?: string; to?: string }

export function formatSurveyDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function surveyDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validateSurveyDateRange(range: SurveyDateRange): SurveyDateRangeErrors {
  const errors: SurveyDateRangeErrors = {};
  const fromError = getDDMMYYYYError(range.from);
  const toError = getDDMMYYYYError(range.to);
  if (fromError) errors.from = fromError;
  if (toError) errors.to = toError;
  const from = parseDDMMYYYY(range.from);
  const to = parseDDMMYYYY(range.to);
  if (from && to && to < from) errors.to = 'To date must be on or after From date.';
  return errors;
}

export function formatSurveyDateRange(range: SurveyDateRange): string {
  if (Object.keys(validateSurveyDateRange(range)).length) throw new Error('Invalid survey date range.');
  return `From: ${formatSurveyDate(parseDDMMYYYY(range.from)!)} To: ${formatSurveyDate(parseDDMMYYYY(range.to)!)}`;
}

export function calendarMonthDays(year: number, month: number): Array<Date | null> {
  const days: Array<Date | null> = Array(new Date(year, month, 1).getDay()).fill(null);
  const total = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= total; day += 1) days.push(new Date(year, month, day));
  while (days.length % 7) days.push(null);
  return days;
}

export function changeCalendarMonth(date: Date, offset: number): Date {
  const first = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()));
}

export function calendarKeyboardDate(date: Date, key: string, shiftKey = false): Date | null {
  const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -date.getDay(), End: 6 - date.getDay() };
  if (key in offsets) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsets[key]);
  if (key === 'PageUp') return changeCalendarMonth(date, shiftKey ? -12 : -1);
  if (key === 'PageDown') return changeCalendarMonth(date, shiftKey ? 12 : 1);
  return null;
}
