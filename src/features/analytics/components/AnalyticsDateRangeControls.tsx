import React from 'react';
import { AnalyticsDateRange, getAnalyticsDateRangeError } from '../domain/dateRange';

interface Props {
  value: AnalyticsDateRange;
  onChange?: (value: AnalyticsDateRange) => void;
}

export function AnalyticsDateRangeControls({ value, onChange }: Props) {
  const error = getAnalyticsDateRangeError(value);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="analytics-date-from">
          From
          <input id="analytics-date-from" type="date" value={value.from} max={value.to || undefined} onChange={(event) => onChange?.({ ...value, from: event.target.value })} aria-invalid={Boolean(error)} aria-describedby="analytics-date-help" className="field h-9 text-sm" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="analytics-date-to">
          To
          <input id="analytics-date-to" type="date" value={value.to} min={value.from || undefined} onChange={(event) => onChange?.({ ...value, to: event.target.value })} aria-invalid={Boolean(error)} aria-describedby="analytics-date-help" className="field h-9 text-sm" />
        </label>
        <button type="button" onClick={() => onChange?.({ from: '', to: '' })} disabled={!value.from && !value.to} className="secondary-button h-9 text-xs disabled:opacity-40">Clear dates</button>
      </div>
      <p id="analytics-date-help" className="mt-2 text-xs text-slate-500 dark:text-slate-400">Filter by submission date in your local time zone. Both dates are included; leave either date blank for an open range.</p>
      {error && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
