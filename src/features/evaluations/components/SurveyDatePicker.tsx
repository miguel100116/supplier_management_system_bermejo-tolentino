import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useModalEscape } from '../../../hooks/useModalEscape';
import { parseDDMMYYYY } from '../../../utils/time';
import { calendarKeyboardDate, calendarMonthDays, changeCalendarMonth, formatSurveyDate, surveyDateKey } from '../domain/surveyDates';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface CalendarProps {
  label: string;
  displayedDate: Date;
  selectedDate: Date | null;
  minimumDate: Date | null;
  focusKey: string;
  onDisplayDate: (date: Date) => void;
  onSelect: (date: Date) => void;
  onNavigate: (date: Date) => void;
  dayRefs?: React.MutableRefObject<Map<string, HTMLButtonElement>>;
}

export function SurveyCalendar({ label, displayedDate, selectedDate, minimumDate, focusKey, onDisplayDate, onSelect, onNavigate, dayRefs }: CalendarProps) {
  const year = displayedDate.getFullYear();
  const month = displayedDate.getMonth();
  const firstYear = Math.min(1900, year, minimumDate?.getFullYear() ?? year);
  const lastYear = Math.max(new Date().getFullYear() + 20, year);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  const previousMonth = changeCalendarMonth(displayedDate, -1);
  const previousMonthEnd = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0);
  return (
    <div role="dialog" aria-label={`Choose ${label} date`} className="absolute left-0 top-full z-[70] mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      <div className="mb-3 flex items-center gap-1">
        <button type="button" aria-label="Previous month" disabled={year <= 1000 && month === 0 || Boolean(minimumDate && previousMonthEnd < minimumDate)} onClick={() => onDisplayDate(previousMonth)} className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronLeft size={16} /></button>
        <select aria-label={`${label} month`} value={month} onChange={(event) => onDisplayDate(new Date(year, Number(event.target.value), Math.min(displayedDate.getDate(), new Date(year, Number(event.target.value) + 1, 0).getDate())))} className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900">
          {months.map((name, index) => <option key={name} value={index}>{name}</option>)}
        </select>
        <select aria-label={`${label} year`} value={year} onChange={(event) => onDisplayDate(new Date(Number(event.target.value), month, Math.min(displayedDate.getDate(), new Date(Number(event.target.value), month + 1, 0).getDate())))} className="rounded border border-slate-200 bg-white px-1 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900">
          {years.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <button type="button" aria-label="Next month" disabled={year >= 9999 && month === 11} onClick={() => onDisplayDate(changeCalendarMonth(displayedDate, 1))} className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronRight size={16} /></button>
      </div>
      <p className="sr-only" aria-live="polite">{months[month]} {year}</p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
        {weekdays.map((day) => <span key={day} className="py-1 text-slate-400" aria-hidden="true">{day}</span>)}
        {calendarMonthDays(year, month).map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />;
          const key = surveyDateKey(date);
          const disabled = Boolean(minimumDate && date < minimumDate);
          const selected = Boolean(selectedDate && key === surveyDateKey(selectedDate));
          return <button key={key} ref={(element) => { if (element) dayRefs?.current.set(key, element); else dayRefs?.current.delete(key); }} type="button" disabled={disabled} tabIndex={key === focusKey ? 0 : -1} aria-label={formatSurveyDate(date)} aria-pressed={selected} onClick={() => onSelect(date)} onKeyDown={(event) => {
            const next = calendarKeyboardDate(date, event.key, event.shiftKey);
            if (!next) return;
            event.preventDefault();
            if (next.getFullYear() < 1000 || next.getFullYear() > 9999) return;
            onNavigate(minimumDate && next < minimumDate ? minimumDate : next);
          }} className={`min-h-8 rounded-md font-medium disabled:cursor-not-allowed disabled:opacity-25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${selected ? 'bg-[#0063a9] text-white' : 'hover:bg-blue-50 dark:hover:bg-slate-800'}`}>{date.getDate()}</button>;
        })}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">Arrow keys move by day or week. Page Up/Down changes month; Shift changes year.</p>
    </div>
  );
}

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimum?: string;
  error?: string;
  required?: boolean;
}

export function SurveyDatePicker({ id, label, value, onChange, minimum, error, required = false }: Props) {
  const [open, setOpen] = useState(false);
  const [displayedDate, setDisplayedDate] = useState(() => parseDDMMYYYY(value) ?? parseDDMMYYYY(minimum) ?? new Date());
  const [focusKey, setFocusKey] = useState(surveyDateKey(displayedDate));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusCalendar = useRef(false);
  const suppressInputOpen = useRef(false);
  const minimumDate = parseDDMMYYYY(minimum);
  const selectedDate = parseDDMMYYYY(value);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      suppressInputOpen.current = true;
      inputRef.current?.focus();
      suppressInputOpen.current = false;
    }
  };
  useModalEscape(open, () => close(true), 60);

  const display = (date: Date) => {
    const anchor = minimumDate && date < minimumDate ? minimumDate : date;
    setDisplayedDate(date);
    const sameMonth = anchor.getFullYear() === date.getFullYear() && anchor.getMonth() === date.getMonth();
    setFocusKey(sameMonth ? surveyDateKey(anchor) : '');
  };
  const show = (moveFocus = false) => {
    focusCalendar.current = moveFocus;
    if (!open) display(selectedDate ?? minimumDate ?? new Date());
    setOpen(true);
    if (open && moveFocus) dayRefs.current.get(focusKey)?.focus();
  };

  useEffect(() => {
    if (open && focusCalendar.current) {
      dayRefs.current.get(focusKey)?.focus();
      focusCalendar.current = false;
    }
  }, [open, focusKey, displayedDate]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!wrapperRef.current?.contains(event.target as Node)) close(); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative w-full min-w-0 sm:w-64" onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close(); }}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}{required && <span className="ml-1 text-rose-500">*</span>}</label>
      <div className="relative">
        <input ref={inputRef} id={id} type="text" inputMode="numeric" placeholder="dd/mm/yyyy" maxLength={10} value={value} aria-required={required} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} aria-expanded={open} aria-haspopup="dialog" onFocus={() => { if (!suppressInputOpen.current) show(); }} onClick={() => show()} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); show(true); } }} className={`field w-full pr-10 ${error ? 'border-rose-400 focus:ring-rose-200' : ''}`} />
        <button type="button" aria-label={`Open ${label} calendar`} aria-expanded={open} onClick={() => open ? close(true) : show(true)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-slate-500 hover:text-[#0063a9] dark:text-slate-400"><CalendarDays size={18} /></button>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-semibold text-rose-500">{error}</p>}
      {open && <SurveyCalendar label={label} displayedDate={displayedDate} selectedDate={selectedDate} minimumDate={minimumDate} focusKey={focusKey} onDisplayDate={(date) => { focusCalendar.current = false; display(date); }} onNavigate={(date) => { focusCalendar.current = true; display(date); }} onSelect={(date) => { onChange(formatSurveyDate(date)); close(true); }} dayRefs={dayRefs} />}
    </div>
  );
}
