import { useMemo, useRef, useState } from 'react';
import { Search, X, GitCompareArrows, RadarIcon, BarChart3 } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArchiveSeries, SurveyResponse, SurveyType } from '../types/survey';
import { surveyTypeDisplayLabel } from '../data/questionWeights';
import { getCompanyTrend, getCompanyTrendBySeries, getLeaderboard, getPeerAverageTrend, getPeerAverageTrendBySeries, getSectionPeerAverages } from '../utils/scoring';

interface CompanyAnalysisPanelProps {
  responses: SurveyResponse[];
  archiveSeries?: ArchiveSeries[];
}

const surveyTypes: SurveyType[] = ['Courier', 'Supplier', 'Subcontractor'];

// Distinct, high-contrast colors for the primary company and the
// comparison series (peer average or another company).
const PRIMARY_COLOR = '#2563eb'; // blue
const COMPARE_COLOR = '#b91c1c'; // muted deep red - distinct from blue, not the alarm-toned bright red

/**
 * Chooses a y-axis / radius-axis domain that "zooms in" when every value in
 * view is comfortably high, so small real differences aren't flattened out
 * by a mostly-empty 0-100 scale. Falls back to the full 0-100 range whenever
 * any value dips below 50, so low scores are never visually exaggerated.
 */
function computeAxisDomain(data: Record<string, unknown>[], keys: string[]): [number, number] {
  const values: number[] = [];
  data.forEach((row) => {
    keys.forEach((key) => {
      const value = row[key];
      if (typeof value === 'number') values.push(value);
    });
  });
  if (!values.length) return [0, 100];

  const min = Math.min(...values);
  if (min < 50) return [0, 100];

  // Round down to the nearest 10, then back off one more gridline so the
  // lowest bar/point still has visible headroom above the axis floor.
  const start = Math.max(0, Math.min(90, Math.floor(min / 10) * 10 - 10));
  return [start, 100];
}

/** Turns a "YYYY-MM" bucket into a compact "Mon 'YY" label for the trend chart's x-axis. */
function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  if (!m) return month; // already year-only (e.g. yearly view)
  const date = new Date(Number(year), Number(m) - 1, 1);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function CompanyAnalysisPanel({ responses, archiveSeries = [] }: CompanyAnalysisPanelProps) {
  const isMobile = useIsMobile();
  const [surveyType, setSurveyType] = useState<SurveyType>('Courier');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Comparison company (replaces "Peer average" on both the section chart and the trend chart when set)
  const [compareCompany, setCompareCompany] = useState<string | null>(null);
  const [compareQuery, setCompareQuery] = useState('');
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const compareInputRef = useRef<HTMLInputElement>(null);

  const [chartView, setChartView] = useState<'radar' | 'bar'>('radar');

  const leaderboard = useMemo(() => getLeaderboard(responses, surveyType), [responses, surveyType]);
  const peerAverages = useMemo(() => getSectionPeerAverages(responses, surveyType), [responses, surveyType]);

  const companyOptions = useMemo(() => leaderboard.map((c) => c.company), [leaderboard]);

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return companyOptions;
    return companyOptions.filter((name) => name.toLowerCase().includes(needle));
  }, [companyOptions, query]);

  // Comparison options: same category, excludes the currently selected company
  const compareOptions = useMemo(
    () => companyOptions.filter((name) => name !== selectedCompany),
    [companyOptions, selectedCompany]
  );

  const filteredCompareOptions = useMemo(() => {
    const needle = compareQuery.trim().toLowerCase();
    if (!needle) return compareOptions;
    return compareOptions.filter((name) => name.toLowerCase().includes(needle));
  }, [compareOptions, compareQuery]);

  const activeComposite = leaderboard.find((c) => c.company === selectedCompany) ?? null;
  const compareComposite = leaderboard.find((c) => c.company === compareCompany) ?? null;

  // Label for the second series - either the chosen comparison company or "Peer average"
  const compareLabel = compareComposite ? compareComposite.company : 'Peer average';

  const chartData = useMemo(() => {
    if (!activeComposite) return [];
    return activeComposite.sections.map((section) => {
      let compareValue: number;
      if (compareComposite) {
        const compareSection = compareComposite.sections.find((s) => s.section === section.section);
        compareValue = compareSection?.percent ?? 0;
      } else {
        const peer = peerAverages.find((p) => p.section === section.section);
        compareValue = peer?.average ?? 0;
      }
      return {
        section: section.section,
        [activeComposite.company]: section.percent,
        [compareLabel]: compareValue,
      };
    });
  }, [activeComposite, compareComposite, peerAverages, compareLabel]);

  const sectionAxisDomain = useMemo(() => {
    if (!activeComposite) return [0, 100] as [number, number];
    return computeAxisDomain(chartData, [activeComposite.company, compareLabel]);
  }, [chartData, activeComposite, compareLabel]);

  const primaryTrend = useMemo(() => {
    if (!selectedCompany) return [];
    return getCompanyTrend(responses, selectedCompany, surveyType);
  }, [responses, selectedCompany, surveyType]);

  // Comparison trend: the chosen company's own trajectory, or the peer average trajectory
  // (excluding the primary company so it doesn't average against itself)
  const compareTrend = useMemo(() => {
    if (!selectedCompany) return [];
    if (compareComposite) {
      return getCompanyTrend(responses, compareComposite.company, surveyType);
    }
    return getPeerAverageTrend(responses, surveyType, selectedCompany);
  }, [responses, selectedCompany, compareComposite, surveyType]);

  const trendData = useMemo(() => {
    if (!activeComposite) return [];
    const months = [...new Set([...primaryTrend.map((t) => t.month), ...compareTrend.map((t) => t.month)])].sort();
    return months.map((month) => {
      const primary = primaryTrend.find((t) => t.month === month);
      const compare = compareTrend.find((t) => t.month === month);
      return {
        month,
        label: formatMonthLabel(month),
        [activeComposite.company]: primary?.score ?? null,
        [compareLabel]: compare?.score ?? null,
      };
    });
  }, [activeComposite, primaryTrend, compareTrend, compareLabel]);

  const [trendGranularity, setTrendGranularity] = useState<'monthly' | 'yearly' | 'series'>('monthly');

  // By-series view: one point per named archive period (e.g. "1st Half 2026"),
  // ordered chronologically - the concrete "project this company's rating
  // trend across periods/years" view.
  const seriesTrendData = useMemo(() => {
    if (!activeComposite) return [];
    const primary = getCompanyTrendBySeries(responses, activeComposite.company, surveyType, archiveSeries);
    const compare = compareComposite
      ? getCompanyTrendBySeries(responses, compareComposite.company, surveyType, archiveSeries)
      : getPeerAverageTrendBySeries(responses, surveyType, archiveSeries, selectedCompany ?? undefined);

    const seriesIds = [...new Set([...primary.map((t) => t.seriesId), ...compare.map((t) => t.seriesId)])];
    const createdAtById = new Map(archiveSeries.map((s) => [s.id, s.createdAt]));
    seriesIds.sort((a, b) => (createdAtById.get(a) ?? '').localeCompare(createdAtById.get(b) ?? ''));

    return seriesIds.map((seriesId) => {
      const p = primary.find((t) => t.seriesId === seriesId);
      const c = compare.find((t) => t.seriesId === seriesId);
      const label = p?.label ?? c?.label ?? 'Unknown';
      return {
        month: seriesId,
        label,
        [activeComposite.company]: p?.score ?? null,
        [compareLabel]: c?.score ?? null,
      };
    });
  }, [responses, activeComposite, compareComposite, surveyType, archiveSeries, selectedCompany, compareLabel]);

  // Yearly view: average every month that falls in the same year into one point per key.
  const yearlyTrendData = useMemo(() => {
    if (!activeComposite) return [];
    const keys = [activeComposite.company, compareLabel];
    const byYear = new Map<string, { sums: Record<string, number>; counts: Record<string, number> }>();

    trendData.forEach((row) => {
      const year = row.month.slice(0, 4);
      const bucket = byYear.get(year) ?? { sums: {}, counts: {} };
      keys.forEach((key) => {
        const value = row[key];
        if (typeof value === 'number') {
          bucket.sums[key] = (bucket.sums[key] ?? 0) + value;
          bucket.counts[key] = (bucket.counts[key] ?? 0) + 1;
        }
      });
      byYear.set(year, bucket);
    });

    return [...byYear.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, bucket]) => {
        const row: Record<string, number | string | null> = { month: year, label: year };
        keys.forEach((key) => {
          row[key] = bucket.counts[key] ? Number((bucket.sums[key] / bucket.counts[key]).toFixed(1)) : null;
        });
        return row;
      });
  }, [trendData, activeComposite, compareLabel]);

  const displayedTrendData =
    trendGranularity === 'yearly' ? yearlyTrendData :
    trendGranularity === 'series' ? seriesTrendData :
    trendData;

  // Same "zoom in when everything's already high" treatment as the section
  // chart above - a trend that hovers in the 85-95 band all year looks like
  // a flat line against a fixed 0-100 axis, hiding the real month-to-month
  // movement the chart exists to show.
  const trendAxisDomain = useMemo(() => {
    if (!activeComposite) return [0, 100] as [number, number];
    return computeAxisDomain(displayedTrendData, [activeComposite.company, compareLabel]);
  }, [displayedTrendData, activeComposite, compareLabel]);

  const handleSelectCompany = (company: string) => {
    setSelectedCompany(company);
    setQuery(company);
    setIsSearchOpen(false);
    // A company can't be compared to itself
    if (compareCompany === company) {
      setCompareCompany(null);
      setCompareQuery('');
    }
  };

  const handleClearSelection = () => {
    setSelectedCompany(null);
    setQuery('');
    inputRef.current?.focus();
    setIsSearchOpen(true);
  };

  const handleSelectCompareCompany = (company: string) => {
    setCompareCompany(company);
    setCompareQuery(company);
    setIsCompareOpen(false);
  };

  const handleClearCompareSelection = () => {
    setCompareCompany(null);
    setCompareQuery('');
    compareInputRef.current?.focus();
    setIsCompareOpen(true);
  };

  if (!responses.length) return null;

  return (
    <section className="panel space-y-4">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-semibold">Company Analysis</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Search for a specific company to see its section breakdown and score trend over time.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 w-full">
          <div className="segmented-control flex-1 w-full md:w-auto grid grid-cols-3">
            {surveyTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={`py-2 text-center w-full flex-1 ${surveyType === type ? 'segmented-active font-bold text-[#0063a9] dark:text-blue-400 shadow-sm' : ''}`}
                onClick={() => {
                  setSurveyType(type);
                  setSelectedCompany(null);
                  setQuery('');
                  setIsSearchOpen(false);
                  setCompareCompany(null);
                  setCompareQuery('');
                  setIsCompareOpen(false);
                }}
              >
                {surveyTypeDisplayLabel[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Both search boxes are centered and shown side by side, visible before any selection is made */}
        <div className="flex flex-col md:flex-row gap-4 justify-center items-stretch md:items-start w-full">
          {/* Company search / combobox */}
          <div className="relative w-full md:w-[22rem] md:max-w-sm">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={isSearchOpen ? query : (selectedCompany || query)}
                onFocus={() => {
                  setIsSearchOpen(true);
                  if (selectedCompany) setQuery('');
                }}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsSearchOpen(true);
                  if (selectedCompany) setSelectedCompany(null);
                }}
                placeholder={`Search ${surveyTypeDisplayLabel[surveyType].toLowerCase()} companies...`}
                className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-[#0063a9] dark:focus:border-blue-500 transition-colors"
              />
              {(selectedCompany || query) && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Clear selection"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {isSearchOpen && (
              <div className="absolute z-20 mt-1.5 w-full max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-lg py-1">
                {filteredOptions.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-slate-400 dark:text-slate-500 text-center">
                    No matching companies.
                  </p>
                ) : (
                  filteredOptions.map((company) => (
                    <button
                      key={company}
                      type="button"
                      onMouseDown={(e) => {
                        // onMouseDown fires before the input's onBlur, so selection registers
                        // before we ever close the dropdown.
                        e.preventDefault();
                        handleSelectCompany(company);
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        company === selectedCompany
                          ? 'bg-blue-50 text-[#0063a9] dark:bg-blue-950/40 dark:text-blue-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'
                      }`}
                    >
                      <span className="truncate">{company}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Click-away backdrop to close the dropdown */}
            {isSearchOpen && (
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsSearchOpen(false)}
              />
            )}
          </div>

          {/* Comparison company search / combobox - always visible, styled distinctly from the primary search */}
          <div className="relative w-full md:w-[22rem] md:max-w-sm">
            <div className="relative">
              <GitCompareArrows size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={compareInputRef}
                type="text"
                value={isCompareOpen ? compareQuery : (compareCompany || compareQuery)}
                onFocus={() => {
                  setIsCompareOpen(true);
                  if (compareCompany) setCompareQuery('');
                }}
                onChange={(e) => {
                  setCompareQuery(e.target.value);
                  setIsCompareOpen(true);
                  if (compareCompany) setCompareCompany(null);
                }}
                placeholder={`Compare with another ${surveyTypeDisplayLabel[surveyType].toLowerCase()}...`}
                className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
              />
              {(compareCompany || compareQuery) && (
                <button
                  type="button"
                  onClick={handleClearCompareSelection}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Clear comparison selection"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {isCompareOpen && (
              <div className="absolute z-20 mt-1.5 w-full max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-lg py-1">
                {filteredCompareOptions.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-slate-400 dark:text-slate-500 text-center">
                    No matching companies.
                  </p>
                ) : (
                  filteredCompareOptions.map((company) => (
                    <button
                      key={company}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectCompareCompany(company);
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        company === compareCompany
                          ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'
                      }`}
                    >
                      <span className="truncate">{company}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {isCompareOpen && (
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsCompareOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {activeComposite ? (
        <div className="flex flex-col gap-6 mt-2">
          {/* Section breakdown - enlarged, full width, with a radar/bar switch */}
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {activeComposite.company} — section breakdown vs {compareLabel.toLowerCase()}
                </h4>
                {sectionAxisDomain[0] > 0 && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Scale starts at {sectionAxisDomain[0]} to highlight differences among high scores.
                  </p>
                )}
              </div>
              <div className="flex max-w-full shrink-0 overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setChartView('radar')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    chartView === 'radar'
                      ? 'bg-[#0063a9] text-white'
                      : 'bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                  aria-label="Show radar chart"
                  aria-pressed={chartView === 'radar'}
                >
                  <RadarIcon size={13} /> Radar
                </button>
                <button
                  type="button"
                  onClick={() => setChartView('bar')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors border-l border-slate-200 dark:border-slate-700 ${
                    chartView === 'bar'
                      ? 'bg-[#0063a9] text-white'
                      : 'bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                  aria-label="Show bar chart"
                  aria-pressed={chartView === 'bar'}
                >
                  <BarChart3 size={13} /> Bar
                </button>
              </div>
            </div>
            <div className="h-[22rem] w-full min-w-0 overflow-hidden md:h-[32rem]">
              <ResponsiveContainer width="100%" height="100%">
                {chartView === 'radar' ? (
                  <RadarChart
                    data={chartData}
                    outerRadius={isMobile ? '58%' : '80%'}
                    margin={isMobile ? { top: 8, right: 16, bottom: 8, left: 16 } : { top: 10, right: 40, bottom: 10, left: 40 }}
                  >
                    <PolarGrid />
                    <PolarAngleAxis dataKey="section" tick={{ fontSize: isMobile ? 9 : 13 }} />
                    <PolarRadiusAxis domain={sectionAxisDomain} tickFormatter={(value: number) => `${value}%`} tick={{ fontSize: isMobile ? 9 : 11 }} />
                    <Radar
                      name={activeComposite.company}
                      dataKey={activeComposite.company}
                      stroke={PRIMARY_COLOR}
                      fill={PRIMARY_COLOR}
                      fillOpacity={0.35}
                    />
                    <Radar
                      name={compareLabel}
                      dataKey={compareLabel}
                      stroke={COMPARE_COLOR}
                      fill={COMPARE_COLOR}
                      fillOpacity={0.3}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
                  </RadarChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="section"
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      interval={0}
                      angle={isMobile ? -25 : 0}
                      textAnchor={isMobile ? 'end' : 'middle'}
                      height={isMobile ? 48 : 28}
                    />
                    <YAxis domain={sectionAxisDomain} width={isMobile ? 34 : 44} tickFormatter={(value: number) => `${value}%`} tick={{ fontSize: isMobile ? 9 : 12 }} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
                    <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} />
                    <Bar dataKey={activeComposite.company} fill={PRIMARY_COLOR} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey={activeComposite.company} position="top" formatter={(value) => `${typeof value === 'number' ? Math.round(value) : value}%`} style={{ fontSize: isMobile ? 8 : 10, fontWeight: 700 }} />
                    </Bar>
                    <Bar dataKey={compareLabel} fill={COMPARE_COLOR} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey={compareLabel} position="top" formatter={(value) => `${typeof value === 'number' ? Math.round(value) : value}%`} style={{ fontSize: isMobile ? 8 : 10, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Score trend - now below the section chart, also reflects the chosen comparison */}
          <div className="flex flex-col">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-1">
              <div>
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Score trend vs {compareLabel.toLowerCase()}
                </h4>
                {trendAxisDomain[0] > 0 && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Scale starts at {trendAxisDomain[0]} to highlight differences among high scores.
                  </p>
                )}
              </div>
              <div className="flex max-w-full shrink-0 overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                {(['monthly', 'yearly', 'series'] as const).map((option, idx) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTrendGranularity(option)}
                    className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${idx > 0 ? 'border-l border-slate-200 dark:border-slate-700' : ''} ${
                      trendGranularity === option
                        ? 'bg-[#0063a9] text-white'
                        : 'bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                    aria-pressed={trendGranularity === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-56 md:h-64">
              {trendGranularity === 'series' && displayedTrendData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400 dark:text-slate-500 text-center px-4">
                  No named archive periods for this company yet - archive a survey with a period label to see it here.
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayedTrendData} margin={{ top: 8, right: isMobile ? 6 : 16, left: isMobile ? -16 : 0, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" minTickGap={isMobile ? 20 : 8} tick={{ fontSize: isMobile ? 9 : 11 }} />
                  <YAxis domain={trendAxisDomain} width={isMobile ? 34 : 44} tickFormatter={(value: number) => `${value}%`} tick={{ fontSize: isMobile ? 9 : 11 }} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
                  <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} />
                  <Line
                    type="monotone"
                    dataKey={activeComposite.company}
                    stroke={PRIMARY_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey={compareLabel}
                    stroke={COMPARE_COLOR}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400 mt-4">
              <span>{activeComposite.ratedQuestionCount} rated criteria</span>
              <span>{activeComposite.naRate}% marked N/A</span>
              <span>Consistency: ±{activeComposite.stdDev} pts std dev per question</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
          Search and select a company above to view its performance analysis.
        </p>
      )}
    </section>
  );
}
