import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarKeyboardDate, calendarMonthDays, changeCalendarMonth, formatSurveyDate, formatSurveyDateRange, validateSurveyDateRange } from './surveyDates';

test('survey date ranges require both real dates and reject an end before the start', () => {
  assert.deepEqual(validateSurveyDateRange({ from: '', to: '' }), { from: 'This date is required.', to: 'This date is required.' });
  assert.equal(validateSurveyDateRange({ from: '31/02/2026', to: '03/10/26' }).from, 'Enter a valid date in dd/mm/yyyy format.');
  assert.equal(validateSurveyDateRange({ from: '31/02/2026', to: '03/10/26' }).to, 'Enter a valid date in dd/mm/yyyy format.');
  assert.equal(validateSurveyDateRange({ from: '01/11/2026', to: '31/10/2026' }).to, 'To date must be on or after From date.');
  assert.deepEqual(validateSurveyDateRange({ from: '31/10/2026', to: '01/11/2026' }), {});
  assert.deepEqual(validateSurveyDateRange({ from: '29/02/2028', to: '29/02/2028' }), {});
});

test('typed and picked dates share the existing persistence and export format', () => {
  const picked = formatSurveyDate(new Date(2026, 9, 3));
  assert.equal(picked, '03/10/2026');
  assert.equal(formatSurveyDateRange({ from: ` ${picked} `, to: '04/10/2026' }), 'From: 03/10/2026 To: 04/10/2026');
  assert.throws(() => formatSurveyDateRange({ from: '04/10/2026', to: '03/10/2026' }), /Invalid survey date range/);
});

test('calendar month grids include all leap days and pad complete weeks', () => {
  const days = calendarMonthDays(2028, 1);
  assert.equal(days.filter(Boolean).length, 29);
  assert.equal(days.length % 7, 0);
  assert.equal(days.slice(0, 2).every((date) => date === null), true);
  assert.equal(formatSurveyDate(days.filter((date): date is Date => Boolean(date)).at(-1)!), '29/02/2028');
});

test('month and year keyboard navigation clamps the day without overflowing into the next month', () => {
  assert.equal(formatSurveyDate(changeCalendarMonth(new Date(2026, 0, 31), 1)), '28/02/2026');
  assert.equal(formatSurveyDate(calendarKeyboardDate(new Date(2028, 1, 29), 'PageDown', true)!), '28/02/2029');
  assert.equal(formatSurveyDate(calendarKeyboardDate(new Date(2026, 9, 3), 'ArrowRight')!), '04/10/2026');
  assert.equal(formatSurveyDate(calendarKeyboardDate(new Date(2026, 9, 3), 'ArrowUp')!), '26/09/2026');
  assert.equal(formatSurveyDate(calendarKeyboardDate(new Date(2026, 9, 3), 'Home')!), '27/09/2026');
  assert.equal(formatSurveyDate(calendarKeyboardDate(new Date(2026, 9, 3), 'End')!), '03/10/2026');
  assert.equal(calendarKeyboardDate(new Date(2026, 9, 3), 'Tab'), null);
});
