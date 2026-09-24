import { Award } from 'lucide-react';
import { formatCompositeScore } from '../../../data/questionWeights';
import { SurveyType } from '../../../types/survey';

interface ChampionCompany {
  name: string;
  count: number;
  rankScore: number;
}

interface ChampionCardProps {
  surveyType: SurveyType;
  company?: ChampionCompany;
  selected: boolean;
  onToggle: () => void;
}

const styles: Record<SurveyType, {
  border: string;
  background: string;
  accent: string;
  ring: string;
  rating: string;
}> = {
  Courier: {
    border: 'border-blue-500',
    background: 'bg-blue-50/5',
    accent: 'text-blue-500',
    ring: 'ring-blue-500 focus-visible:ring-blue-500',
    rating: 'text-blue-600 dark:text-blue-400',
  },
  Supplier: {
    border: 'border-emerald-500',
    background: 'bg-emerald-50/5',
    accent: 'text-emerald-500',
    ring: 'ring-emerald-500 focus-visible:ring-emerald-500',
    rating: 'text-emerald-600 dark:text-emerald-400',
  },
  Subcontractor: {
    border: 'border-orange-500',
    background: 'bg-orange-50/5',
    accent: 'text-orange-500',
    ring: 'ring-orange-500 focus-visible:ring-orange-500',
    rating: 'text-orange-600 dark:text-orange-400',
  },
};

export function ChampionCard({ surveyType, company, selected, onToggle }: ChampionCardProps) {
  const style = styles[surveyType];

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={`Show the top ${surveyType} in the main performance card`}
      className={`panel w-full p-4 text-left flex flex-col justify-between border-t-4 ${style.border} ${style.background} ${style.ring} dark:bg-slate-900/10 cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
        selected ? 'ring-2 ring-offset-2 dark:ring-offset-slate-950' : 'opacity-80 hover:opacity-100'
      }`}
    >
      <span className="space-y-2">
        <span className="flex items-center justify-between">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${style.accent}`}>Top {surveyType}</span>
          <Award className={`${style.accent} shrink-0`} size={16} />
        </span>
        {company ? (
          <span className="block">
            <span className="block truncate text-lg font-bold text-slate-800 dark:text-white">{company.name}</span>
            <span className="mt-1 block text-xs text-slate-400">Based on {company.count} submitted evaluations</span>
          </span>
        ) : (
          <span className="block text-xs text-slate-400">No evaluations submitted yet.</span>
        )}
      </span>
      {company && (
        <span className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800/50">
          <span className="text-xs font-semibold text-slate-500">Employee Rating</span>
          <span className={`text-xs font-bold ${style.rating}`}>
            {formatCompositeScore(surveyType, company.rankScore).text} ({Math.round(company.rankScore)}%)
          </span>
        </span>
      )}
    </button>
  );
}
