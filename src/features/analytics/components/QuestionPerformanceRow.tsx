import React from 'react';

interface QuestionPerformanceRowProps {
  rank: number;
  question: string;
  average: number;
}

export function QuestionPerformanceRow({ rank, question, average }: QuestionPerformanceRowProps) {
  const boundedAverage = Math.max(0, Math.min(100, average));

  return (
    <li className="flex items-start gap-3 border-b border-slate-100 py-3 dark:border-slate-800">
      <span className="w-6 shrink-0 pt-0.5 text-center text-[11px] font-bold text-slate-400">{rank}</span>
      <span className="min-w-0 flex-1">
        <span className="block whitespace-normal break-words text-xs font-medium leading-5 text-slate-700 dark:text-slate-200">
          {question}
        </span>
        <span
          className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-label={`Average score for ${question}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={boundedAverage}
        >
          <span
            className="block h-full rounded-full bg-[#0078a8]"
            style={{ width: `${boundedAverage}%` }}
          />
        </span>
      </span>
      <span className="shrink-0 pt-0.5 text-xs font-bold tabular-nums text-[#0078a8]">
        {average.toFixed(1)}
      </span>
    </li>
  );
}
