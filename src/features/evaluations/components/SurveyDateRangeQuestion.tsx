import React from 'react';
import { SurveyDatePicker } from './SurveyDatePicker';
import { SurveyDateRange, validateSurveyDateRange } from '../domain/surveyDates';

interface Props {
  id: string;
  value: SurveyDateRange;
  showErrors: boolean;
  onChange: (field: 'from' | 'to', value: string) => void;
}

export function SurveyDateRangeQuestion({ id, value, showErrors, onChange }: Props) {
  const errors = showErrors ? validateSurveyDateRange(value) : {};
  return <div>
    <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Duration (From - To):</span>
    <div className="flex flex-wrap items-start gap-4">
      <SurveyDatePicker id={`${id}-from`} label="From" value={value.from} required error={errors.from} onChange={(date) => onChange('from', date)} />
      <SurveyDatePicker id={`${id}-to`} label="To" value={value.to} minimum={value.from} required error={errors.to} onChange={(date) => onChange('to', date)} />
    </div>
  </div>;
}
