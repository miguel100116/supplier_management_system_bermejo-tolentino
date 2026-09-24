import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatCompositeScore } from '../../../data/questionWeights';
import { SurveyType } from '../../../types/survey';

interface HighlightCompany {
  name: string;
  count: number;
  rankScore: number;
  type: SurveyType | 'N/A';
}

interface PerformanceHighlightsProps {
  highestCompany: HighlightCompany;
  highestLabel: string;
  lowestCompany: HighlightCompany;
  lowestLabel: string;
}

function scoreText(company: HighlightCompany) {
  return company.type === 'N/A' ? 'No score' : formatCompositeScore(company.type, company.rankScore).text;
}

function HighlightRow({ company, label, variant }: { company: HighlightCompany; label: string; variant: 'high' | 'low' }) {
  const isHigh = variant === 'high';
  const Icon = isHigh ? TrendingUp : TrendingDown;
  const accent = isHigh
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-600 dark:text-rose-400';
  const stroke = isHigh ? 'stroke-emerald-500 dark:stroke-emerald-400' : 'stroke-rose-500 dark:stroke-rose-400';
  const progress = Math.max(0, Math.min(100, company.rankScore));

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${accent}`}>
          <Icon size={13} aria-hidden="true" />
          <span className="truncate">{label}</span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100" title={company.name}>{company.name}</p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          <span className={`font-semibold ${accent}`}>{scoreText(company)}</span>
          <span aria-hidden="true"> / </span>
          {company.count} evaluation{company.count === 1 ? '' : 's'}
        </p>
      </div>
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r="25" className="fill-none stroke-slate-100 dark:stroke-slate-800" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r="25"
            className={`fill-none ${stroke}`}
            strokeWidth="5"
            strokeDasharray="157.08"
            strokeDashoffset={157.08 - (157.08 * progress) / 100}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute text-xs font-bold tabular-nums ${accent}`}>{Math.round(progress)}%</span>
      </div>
    </div>
  );
}

export function PerformanceHighlights({ highestCompany, highestLabel, lowestCompany, lowestLabel }: PerformanceHighlightsProps) {
  return (
    <article className="panel flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800/60">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Range</p>
          <h3 className="mt-0.5 text-sm font-semibold">Performance highlights</h3>
        </div>
        <span className="badge">Extremes</span>
      </div>
      <div className="grid flex-1 gap-4 divide-y divide-slate-100 dark:divide-slate-800">
        <HighlightRow company={highestCompany} label={highestLabel} variant="high" />
        <div className="pt-4">
          <HighlightRow company={lowestCompany} label={lowestLabel} variant="low" />
        </div>
      </div>
    </article>
  );
}
