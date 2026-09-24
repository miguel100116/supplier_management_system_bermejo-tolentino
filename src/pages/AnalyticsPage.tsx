import { useState, useMemo, useEffect } from 'react';
import { ClipboardList } from 'lucide-react';
import { motion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartCard } from '../components/ChartCard';
import { CompanyLeaderboardPanel } from '../components/CompanyLeaderboardPanel';
import { CompanyAnalysisPanel } from '../components/CompanyAnalysisPanel';
import { StateMessage } from '../components/StateMessage';
import { StatCard } from '../components/StatCard';
import { useIsMobile } from '../hooks/useIsMobile';
import { ArchiveSeries, FilterState, SurveyResponse, SurveyType } from '../types/survey';
import {
  getScoreAxisDomain,
  questionPerformance,
  responseVolume,
  formatNumber,
  submissionCount,
  monthlyTrend,
  yearlyTrend,
  seriesTrend,
  submissionScores,
  getCompanyPerformance,
} from '../utils/analytics';
import { RankingMode } from '../utils/scoring';
import { getBand, formatCompositeScore } from '../data/questionWeights';
import { getCompanyPerformanceRanking, rankCompanySummaries } from '../features/analytics/domain/rankings';
import { ChampionCard } from '../features/analytics/components/ChampionCard';
import { AnalyticsSection } from '../features/analytics/components/AnalyticsSection';
import { AnalyticsToolbar } from '../features/analytics/components/AnalyticsToolbar';
import { PerformanceHighlights } from '../features/analytics/components/PerformanceHighlights';

interface AnalyticsPageProps {
  responses: SurveyResponse[];
  activeSurveyTypes: SurveyType[];
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  dataScope?: 'current' | 'all-time' | 'custom';
  onChangeDataScope?: (scope: 'current' | 'all-time' | 'custom') => void;
  archiveSeries?: ArchiveSeries[];
  selectedSeriesIds?: string[];
  onChangeSelectedSeriesIds?: (ids: string[]) => void;
}

const surveyTypeColors: Record<SurveyType, string> = {
  Courier: '#2563eb',
  Supplier: '#10b981',
  Subcontractor: '#f97316',
};

const categoryColors: Record<string, {
  text: string;
  bg: string;
  border: string;
  stroke: string;
  badgeBg: string;
  borderT: string;
  borderClass: string;
  label: string;
}> = {
  Courier: {
    text: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50/40 dark:bg-blue-950/10',
    border: 'border-blue-100 dark:border-blue-900/30',
    stroke: 'stroke-blue-600 dark:stroke-blue-400',
    badgeBg: 'bg-blue-100 text-blue-850 dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800',
    borderT: 'border-t-blue-500',
    borderClass: 'border-blue-500',
    label: 'Courier',
  },
  Supplier: {
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50/40 dark:bg-emerald-950/10',
    border: 'border-emerald-100 dark:border-emerald-900/30',
    stroke: 'stroke-emerald-600 dark:stroke-emerald-400',
    badgeBg: 'bg-emerald-100 text-emerald-850 dark:bg-emerald-900/50 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-850',
    borderT: 'border-t-emerald-500',
    borderClass: 'border-emerald-500',
    label: 'Supplier',
  },
  Subcontractor: {
    text: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50/40 dark:bg-orange-950/10',
    border: 'border-orange-100 dark:border-orange-900/30',
    stroke: 'stroke-orange-600 dark:stroke-orange-400',
    badgeBg: 'bg-orange-100 text-orange-850 dark:bg-orange-900/50 dark:text-orange-200 border border-orange-200 dark:border-orange-800',
    borderT: 'border-t-orange-500',
    borderClass: 'border-orange-500',
    label: 'Subcontractor',
  },
  'N/A': {
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-50/40 dark:bg-slate-950/10',
    border: 'border-slate-100 dark:border-slate-800/30',
    stroke: 'stroke-slate-600 dark:stroke-slate-400',
    badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-200 border border-slate-200 dark:border-slate-800',
    borderT: 'border-t-slate-500',
    borderClass: 'border-slate-500',
    label: 'Overall',
  }
};

function truncateQuestion(text: string, max = 44) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function AnalyticsPage({
  responses,
  activeSurveyTypes,
  filters,
  setFilters,
  dataScope = 'current',
  onChangeDataScope,
  archiveSeries = [],
  selectedSeriesIds = [],
  onChangeSelectedSeriesIds
}: AnalyticsPageProps) {
  const isMobile = useIsMobile();
  const [limit, setLimit] = useState<5 | 10>(5);
  const [performanceMode, setPerformanceMode] = useState<'highest' | 'lowest'>('highest');
  const [trendGranularity, setTrendGranularity] = useState<'monthly' | 'yearly' | 'series'>('monthly');
  const [rankingMode, setRankingMode] = useState<RankingMode>('weighted');

  const comparableResponses = responses;

  const totalResponses = useMemo(() => submissionCount(responses), [responses]);

  // Unified {key, average, responses} shape so the same LineChart can be fed
  // by whichever granularity is selected - month-to-month, year-over-year
  // (for multi-year projections), or by named archive series/period.
  const monthlyTrendData = useMemo(() => monthlyTrend(responses).map((d) => ({ key: d.month, average: d.average, responses: d.responses })), [responses]);
  const yearlyTrendData = useMemo(() => yearlyTrend(responses).map((d) => ({ key: d.year, average: d.average, responses: d.responses })), [responses]);
  const seriesTrendData = useMemo(() => seriesTrend(responses, archiveSeries).map((d) => ({ key: d.label, average: d.average, responses: d.responses })), [responses, archiveSeries]);
  const trend =
    trendGranularity === 'yearly' ? yearlyTrendData :
    trendGranularity === 'series' ? seriesTrendData :
    monthlyTrendData;

  const questions = useMemo(() => questionPerformance(responses), [responses]);

  const companyAverages = useMemo(() => {
    const companyMap: Record<string, { name: string; sum: number; count: number; type: SurveyType }> = {};

    submissionScores(responses).forEach((submission) => {
      if (!companyMap[submission.company]) {
        companyMap[submission.company] = {
          name: submission.company,
          sum: 0,
          count: 0,
          type: submission.surveyType,
        };
      }
      companyMap[submission.company].sum += submission.score;
      companyMap[submission.company].count += 1;
    });

    return Object.values(companyMap)
      .map((c) => {
        const average = c.count > 0 ? c.sum / c.count : 0;
        return {
          name: c.name,
          average,
          scorePercentage: average,
          count: c.count,
          type: c.type,
        };
      })
      .sort((a, b) => b.average - a.average);
  }, [responses]);

  const activeCategory = useMemo(() => {
    return filters.surveyType && filters.surveyType.length === 1 ? filters.surveyType[0] : 'All';
  }, [filters.surveyType]);

  const evaluatedCompanyAverages = useMemo(
    () => rankCompanySummaries(companyAverages.filter((company) => company.count > 0), rankingMode),
    [companyAverages, rankingMode]
  );

  const categoryCompanyAverages = useMemo(() => {
    if (activeCategory === 'All') return evaluatedCompanyAverages;
    return rankCompanySummaries(
      companyAverages.filter((company) => company.count > 0 && company.type === activeCategory),
      rankingMode,
    );
  }, [companyAverages, evaluatedCompanyAverages, activeCategory, rankingMode]);

  const highestCompany = useMemo(() => {
    return categoryCompanyAverages[0] || { name: 'No Evaluated Partners', average: 0, scorePercentage: 0, rankScore: 0, count: 0, type: 'N/A' as const };
  }, [categoryCompanyAverages]);

  const lowestCompany = useMemo(() => {
    return categoryCompanyAverages[categoryCompanyAverages.length - 1] || { name: 'No Evaluated Partners', average: 0, scorePercentage: 0, rankScore: 0, count: 0, type: 'N/A' as const };
  }, [categoryCompanyAverages]);

  const highestLabel = activeCategory === 'All' 
    ? 'Highest Rated Company' 
    : `Highest Rated ${activeCategory}`;

  const lowestLabel = activeCategory === 'All' 
    ? 'Lowest Rated Company' 
    : `Lowest Rated ${activeCategory}`;

  const [selectedChampionType, setSelectedChampionType] = useState<'Overall' | 'Courier' | 'Supplier' | 'Subcontractor'>('Overall');

  // Sync category state with page category filter changes
  useEffect(() => {
    if (activeCategory === 'All') {
      setSelectedChampionType('Overall');
    } else {
      setSelectedChampionType(activeCategory);
    }
  }, [activeCategory]);

  const topCompany = useMemo(() => {
    return evaluatedCompanyAverages[0] || { name: 'No Evaluated Partners', average: 0, scorePercentage: 0, rankScore: 0, type: 'N/A' as const, count: 0 };
  }, [evaluatedCompanyAverages]);

  const topContractor = useMemo(
    () => rankCompanySummaries(companyAverages.filter((company) => company.count > 0 && company.type === 'Courier'), rankingMode)[0],
    [companyAverages, rankingMode]
  );
  const topSupplier = useMemo(
    () => rankCompanySummaries(companyAverages.filter((company) => company.count > 0 && company.type === 'Supplier'), rankingMode)[0],
    [companyAverages, rankingMode]
  );
  const topSubcontractor = useMemo(
    () => rankCompanySummaries(companyAverages.filter((company) => company.count > 0 && company.type === 'Subcontractor'), rankingMode)[0],
    [companyAverages, rankingMode]
  );

  const displayedCompany = useMemo(() => {
    if (selectedChampionType === 'Overall') return topCompany;
    if (selectedChampionType === 'Courier') return topContractor || { name: 'No Evaluated Couriers', average: 0, scorePercentage: 0, rankScore: 0, type: 'Courier', count: 0 };
    if (selectedChampionType === 'Supplier') return topSupplier || { name: 'No Evaluated Suppliers', average: 0, scorePercentage: 0, rankScore: 0, type: 'Supplier', count: 0 };
    if (selectedChampionType === 'Subcontractor') return topSubcontractor || { name: 'No Evaluated Subcontractors', average: 0, scorePercentage: 0, rankScore: 0, type: 'Subcontractor', count: 0 };
    return topCompany;
  }, [selectedChampionType, topCompany, topContractor, topSupplier, topSubcontractor]);

  const score = displayedCompany.rankScore;
  const activeColor = categoryColors[displayedCompany.type] || categoryColors['N/A'];
  const standingLabel = displayedCompany.type === 'N/A' ? 'No Data' : getBand(displayedCompany.type, score).label;
  const displayedScoreText = displayedCompany.type === 'N/A'
    ? 'No score'
    : formatCompositeScore(displayedCompany.type, displayedCompany.rankScore).text;

  const truncateCompanyName = (name: string, maxLen = 14) => {
    return name.length > maxLen ? `${name.substring(0, maxLen)}…` : name;
  };

  const topCompaniesData = useMemo(() => {
    return getCompanyPerformanceRanking(
      comparableResponses,
      activeSurveyTypes,
      rankingMode,
      performanceMode,
      limit,
    );
  }, [comparableResponses, activeSurveyTypes, rankingMode, performanceMode, limit]);

  const topCompaniesAxisDomain = useMemo(
    () => getScoreAxisDomain(topCompaniesData.map((item) => item.score)),
    [topCompaniesData],
  );

  const rankedQuestions = questions;
  const topQuestions = rankedQuestions.slice(0, 5);
  const remainingQuestions = rankedQuestions.slice(5);
  const bottomQuestions = remainingQuestions.slice(-5);
  const spreadQuestions = [...topQuestions, ...bottomQuestions];

  const responseVolumeData = useMemo(
    () => responseVolume(comparableResponses, activeSurveyTypes),
    [comparableResponses, activeSurveyTypes],
  );

  const toggleSurveyType = (type: SurveyType) => {
    let newTypes = [...filters.surveyType];
    if (newTypes.includes(type)) {
      newTypes = newTypes.filter((t) => t !== type);
    } else {
      newTypes.push(type);
    }
    setFilters({ ...filters, surveyType: newTypes });
  };

  const allSurveyTypes: SurveyType[] = ['Courier', 'Supplier', 'Subcontractor'];

  const toggleSelectedSeries = (id: string) => {
    if (!onChangeSelectedSeriesIds) return;
    const next = selectedSeriesIds.includes(id)
      ? selectedSeriesIds.filter((s) => s !== id)
      : [...selectedSeriesIds, id];
    onChangeSelectedSeriesIds(next);
  };

  const scopeToolbar = (onChangeDataScope || responses.length > 0) && (
    <AnalyticsToolbar
      dataScope={dataScope}
      onChangeDataScope={onChangeDataScope}
      rankingMode={rankingMode}
      onChangeRankingMode={setRankingMode}
      archiveSeries={archiveSeries}
      selectedSeriesIds={selectedSeriesIds}
      onToggleSeries={toggleSelectedSeries}
    />
  );

  if (!responses.length) {
    return (
      <div className="space-y-5">
        {scopeToolbar}
        <StateMessage
          title="No analytics available"
          message={
            dataScope === 'custom'
              ? 'Select at least one period above to view its analytics.'
              : 'Adjust filters to compare survey groups.'
          }
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-8 lg:space-y-10">
      {scopeToolbar}

      <AnalyticsSection
        id="analytics-overview"
        eyebrow="Overview"
        title="Performance at a glance"
        description="Start with the leading partner, response volume, and the current performance range before exploring detailed comparisons."
      >
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.85fr)]">
          {/* Prominent KPI Section: Overall Satisfaction */}
          <div className="panel relative flex min-h-[20rem] flex-col items-center justify-between gap-5 overflow-hidden border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/50 p-5 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20 sm:p-6 md:flex-row md:gap-8">
        
        {/* Left Side: Circular Gauge */}
        <div className="relative flex h-36 w-36 shrink-0 items-center justify-center sm:h-40 sm:w-40">
          <svg viewBox="0 0 192 192" className="h-full w-full -rotate-90 transform">
            {/* Underlay Track */}
            <circle
              cx="96"
              cy="96"
              r="75"
              className="stroke-slate-100 dark:stroke-slate-800/50 fill-none"
              strokeWidth="10"
            />
            {/* Animated Segment Progress */}
            <motion.circle
              cx="96"
              cy="96"
              r="75"
              className={`${activeColor.stroke} fill-none`}
              strokeWidth="10"
              strokeDasharray="471.2"
              initial={{ strokeDashoffset: 471.2 }}
              animate={{ strokeDashoffset: 471.2 - (471.2 * score) / 100 }}
              key={displayedCompany.name}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              strokeLinecap="round"
            />
          </svg>
          
          {/* Centered Number Overlay */}
          <div className="absolute flex flex-col items-center justify-center text-center px-4">
            <motion.span
              className={`text-3xl font-light tracking-tight min-[420px]:text-4xl ${activeColor.text}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              key={displayedCompany.name}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              {formatNumber(score, 0)}%
            </motion.span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1 block max-w-[120px] truncate" title={displayedCompany.name}>
              {displayedCompany.name}
            </span>
          </div>
        </div>

        {/* Right Side: Overall Satisfaction Texts on its Side */}
        <div className="min-w-0 flex-1 space-y-4 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <span className="text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {activeCategory === 'All' ? 'Top Performing Partner' : `Top Performing ${activeCategory}`}
            </span>
            <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${activeColor.badgeBg}`}>
              {displayedCompany.type} Champion
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="break-words text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {displayedCompany.name}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
              {displayedCompany.name.startsWith('No Evaluated')
                ? 'No evaluations are registered. Employees can submit evaluations using the published survey forms.'
                : `${displayedCompany.name} is recognized as the top-performing ${displayedCompany.type.toLowerCase()} partner, earning the highest combined satisfaction score of ${displayedScoreText} across all survey categories from Microgenesis employees.`
              }
            </p>
          </div>

          <div className="grid gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500 sm:grid-cols-3 sm:gap-3">
            <div className="flex items-center gap-1.5">
              <span>Combined average:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{displayedScoreText}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Evaluations:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{displayedCompany.count} submissions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Standing category:</span>
              <span className={`font-semibold ${activeColor.text}`}>{standingLabel}</span>
            </div>
          </div>
        </div>
          </div>

          <div className="grid min-w-0 items-start gap-4 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] xl:grid-cols-1">
            <StatCard
              label="Total Responses"
              value={String(totalResponses)}
              detail="Submitted evaluations extracted directly from Microsoft Forms platforms."
              icon={ClipboardList}
            />
            <PerformanceHighlights
              highestCompany={highestCompany}
              highestLabel={highestLabel}
              lowestCompany={lowestCompany}
              lowestLabel={lowestLabel}
            />
          </div>
        </div>

      {/* Category Champions Section (Interactive toggle, ONLY shown on "All" view) */}
      {activeCategory === 'All' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ChampionCard
            surveyType="Courier"
            company={topContractor}
            selected={selectedChampionType === 'Courier'}
            onToggle={() => setSelectedChampionType(selectedChampionType === 'Courier' ? 'Overall' : 'Courier')}
          />
          <ChampionCard
            surveyType="Supplier"
            company={topSupplier}
            selected={selectedChampionType === 'Supplier'}
            onToggle={() => setSelectedChampionType(selectedChampionType === 'Supplier' ? 'Overall' : 'Supplier')}
          />
          <ChampionCard
            surveyType="Subcontractor"
            company={topSubcontractor}
            selected={selectedChampionType === 'Subcontractor'}
            onToggle={() => setSelectedChampionType(selectedChampionType === 'Subcontractor' ? 'Overall' : 'Subcontractor')}
          />
        </div>
      )}
      </AnalyticsSection>

      <AnalyticsSection
        id="analytics-trends"
        eyebrow="Trends & comparisons"
        title="Understand movement and distribution"
        description="Compare stakeholder groups, review the strongest and weakest company results, and follow score movement over time."
      >
      <section className="panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold">Survey Comparison</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Compare satisfaction patterns across stakeholder groups.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {allSurveyTypes.map((type) => {
                const isActive = activeSurveyTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleSurveyType(type)}
                    aria-pressed={isActive}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                      isActive ? 'border-transparent text-white shadow-sm' : 'border-slate-200 bg-transparent text-slate-600 dark:border-slate-700 dark:text-slate-400'
                    }`}
                    style={isActive ? { backgroundColor: surveyTypeColors[type] } : {}}
                  >
                    {isActive && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }} />}
                    {type}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <ChartCard
          title={performanceMode === 'highest' ? `Top ${limit} Best Performing Companies` : `Top ${limit} Least Rated Companies`}
          subtitle={
            `${rankingMode === 'weighted' ? 'Volume-weighted' : 'Pure average'} ranking based on ${activeSurveyTypes.map(t => t + 's').join(' & ')} ratings` +
            (topCompaniesAxisDomain[0] > 0 ? ` — scale starts at ${topCompaniesAxisDomain[0]} to highlight differences among close scores` : '')
          }
          action={
            <div className="flex items-center gap-2 text-xs">
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => setPerformanceMode('highest')}
                  aria-pressed={performanceMode === 'highest'}
                  className={`px-2 py-1 rounded-md font-semibold transition ${
                    performanceMode === 'highest'
                      ? 'bg-white dark:bg-slate-800 text-[#0063a9] dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Best
                </button>
                <button
                  type="button"
                  onClick={() => setPerformanceMode('lowest')}
                  aria-pressed={performanceMode === 'lowest'}
                  className={`px-2 py-1 rounded-md font-semibold transition ${
                    performanceMode === 'lowest'
                      ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Lowest
                </button>
              </div>

              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => setLimit(5)}
                  aria-pressed={limit === 5}
                  aria-label="Show 5 companies"
                  className={`px-2 py-1 rounded-md font-semibold transition ${
                    limit === 5
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => setLimit(10)}
                  aria-pressed={limit === 10}
                  aria-label="Show 10 companies"
                  className={`px-2 py-1 rounded-md font-semibold transition ${
                    limit === 10
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  10
                </button>
              </div>
            </div>
          }
        >
          {topCompaniesData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCompaniesData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="company"
                  tickFormatter={(v) => truncateCompanyName(v, isMobile ? 8 : 12)}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                />
                <YAxis
                  domain={topCompaniesAxisDomain}
                  width={isMobile ? 34 : 42}
                  tickFormatter={(value: number) => `${value}%`}
                  tick={{ fontSize: isMobile ? 9 : 10, fill: '#64748b' }}
                />
                <Tooltip formatter={(value) => [`${typeof value === 'number' ? formatNumber(value, 1) : value}%`, rankingMode === 'weighted' ? 'Weighted score' : 'Average score']} />
                <Bar
                  dataKey="score"
                  radius={[6, 6, 0, 0]}
                  barSize={isMobile ? 24 : 40}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="score"
                    position="top"
                    formatter={(value) => `${typeof value === 'number' ? Math.round(value) : value}%`}
                    style={{ fill: '#475569', fontSize: isMobile ? 9 : 10, fontWeight: 'bold' }}
                  />
                  {topCompaniesData.map((entry) => (
                    <Cell key={entry.company} fill={surveyTypeColors[entry.surveyType]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
              No company data fits the filters.
            </div>
          )}
        </ChartCard>
        <ChartCard title="Response Volume" subtitle="Filtered response counts by survey">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={responseVolumeData} margin={{ top: 8, right: 6, left: isMobile ? -24 : 0, bottom: isMobile ? 18 : 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="surveyType"
                interval={0}
                angle={isMobile ? -20 : 0}
                textAnchor={isMobile ? 'end' : 'middle'}
                height={isMobile ? 44 : 30}
                tick={{ fontSize: isMobile ? 9 : 12 }}
              />
              <YAxis allowDecimals={false} width={isMobile ? 30 : 40} tick={{ fontSize: isMobile ? 9 : 12 }} />
              <Tooltip />
              <Bar dataKey="responses" radius={[6, 6, 0, 0]}>
                {responseVolumeData.map((entry) => (
                  <Cell key={entry.surveyType} fill={surveyTypeColors[entry.surveyType]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Moved from Dashboard: Trend (Monthly / Yearly / By Series) */}
      <div className="grid min-w-0 grid-cols-1 gap-4">
        <ChartCard
          title="Rating Trend"
          subtitle={
            trendGranularity === 'yearly'
              ? 'Average score and response volume by year - use this to project a long-run trend'
              : trendGranularity === 'series'
                ? 'Average score and response volume by named archive period'
                : 'Average score and response volume over time'
          }
          action={
            <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-1">
              {([
                ['monthly', 'Monthly'],
                ['yearly', 'Yearly'],
                ['series', 'By Series'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTrendGranularity(key)}
                  aria-pressed={trendGranularity === key}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    trendGranularity === key
                      ? 'bg-[#0063a9] text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          {trend.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              {trendGranularity === 'series' ? 'No named archive periods yet - archive a survey with a period label to see them here.' : 'No data for this view.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: isMobile ? 0 : 8, left: isMobile ? -8 : 0, bottom: isMobile ? 12 : 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" minTickGap={isMobile ? 20 : 8} tick={{ fontSize: isMobile ? 9 : 12 }} />
                <YAxis yAxisId="left" domain={[0, 100]} width={isMobile ? 34 : 48} tickFormatter={(value: number) => `${value}%`} tick={{ fill: '#2563eb', fontSize: isMobile ? 9 : 12 }} />
                <YAxis yAxisId="right" orientation="right" width={isMobile ? 28 : 48} allowDecimals={false} tick={{ fill: '#10b981', fontSize: isMobile ? 9 : 12 }} />
                <Tooltip formatter={(value, name) => [name === 'Average score (left axis)' ? `${value}%` : value, name]} />
                <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} />
                <Line yAxisId="left" type="monotone" dataKey="average" name="Average score (left axis)" stroke="#2563eb" strokeWidth={3} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="responses" name="Responses (right axis)" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
      </AnalyticsSection>

      <AnalyticsSection
        id="analytics-companies"
        eyebrow="Company exploration"
        title="Review standings and investigate a partner"
        description="Use the leaderboard for a ranked overview, then search or compare individual companies for section-level detail."
      >
        <div className="space-y-4">
          <CompanyLeaderboardPanel
            responses={comparableResponses}
            rankingMode={rankingMode}
          />
          <CompanyAnalysisPanel responses={comparableResponses} archiveSeries={archiveSeries} />
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        id="analytics-questions"
        eyebrow="Question detail"
        title="Find strengths and improvement areas"
        description="Scan the strongest and weakest criteria first, then review the complete ranked question list."
      >
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <ChartCard
            title="Top and Bottom Questions"
            subtitle="5 highest and 5 lowest scoring questions"
            contentClassName="h-[24rem] sm:h-[28rem]"
          >
            <div className="mb-2 flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                Top 5
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                Bottom 5
              </span>
            </div>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={spreadQuestions} layout="vertical" margin={{ left: 4, right: isMobile ? 12 : 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: isMobile ? 10 : 12 }} />
                <YAxis
                  dataKey="question"
                  type="category"
                  width={isMobile ? 92 : 170}
                  tick={{ fontSize: isMobile ? 9 : 11 }}
                  tickFormatter={(value: string) => truncateQuestion(value, isMobile ? 15 : 38)}
                  interval={0}
                />
                <Tooltip labelFormatter={(value) => String(value)} wrapperStyle={{ maxWidth: 320, whiteSpace: 'normal' }} />
                <Bar dataKey="average" radius={[0, 6, 6, 0]}>
                  {spreadQuestions.map((entry, index) => (
                    <Cell key={entry.question} fill={index < topQuestions.length ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

      {/* Moved from Dashboard: Question Performance List */}
      <ChartCard
        title="Question Performance"
        subtitle="All questions, ranked by average rating (highest to lowest)"
        contentClassName="h-[24rem] overflow-y-auto pr-1 sm:h-[28rem]"
      >
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          {questions.map((item, index) => {
            const pct = Math.max(0, Math.min(100, item.average));
            const norm = item.average / 100;
            const tone =
              norm >= 0.75
                ? { text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500' }
                : norm >= 0.50
                  ? { text: 'text-yellow-700 dark:text-yellow-400', bar: 'bg-yellow-500' }
                  : norm >= 0.25
                    ? { text: 'text-orange-700 dark:text-orange-400', bar: 'bg-orange-500' }
                    : { text: 'text-red-700 dark:text-red-400', bar: 'bg-red-500' };

            return (
              <li key={item.question} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-200">{item.question}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-1.5 rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{item.responses} responses</span>
                  </div>
                </div>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${tone.text}`}>{item.average.toFixed(1)}</span>
              </li>
            );
          })}
        </ol>
      </ChartCard>
        </div>
      </AnalyticsSection>
    </div>
  );
}
