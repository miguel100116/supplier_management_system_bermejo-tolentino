import { useMemo, useRef, useState } from 'react';
import { Archive, ClipboardList, FileText, RefreshCw, Calendar, Building2, UserCheck, Trash2, ArrowLeft, Search, Download, Upload, Loader2, X, Sparkles, TrendingUp, Pencil, Check } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArchiveSeries, CustomForm, SurveyResponse, SurveyType } from '../types/survey';
import { exportArchivedResponsesAsExcel } from '../utils/archiveResponseTransfer';
import type { ArchiveImportResult } from '../utils/archiveResponseTransfer';
import { ChartCard } from '../components/ChartCard';
import { useIsMobile } from '../hooks/useIsMobile';
import { seriesTrend, companySeriesTrend } from '../utils/analytics';

interface ArchivePageProps {
  surveys: CustomForm[];
  archivedResponses: SurveyResponse[];
  archiveSeries?: ArchiveSeries[];
  onRenameArchiveSeries?: (id: string, newLabel: string) => void;
  onUpdateSurvey?: (survey: CustomForm) => void;
  onRestoreResponseGroup?: (responseId: string) => void;
  onRestoreResponsesForSurvey?: (surveyId: string) => void;
  onDeleteArchivedResponseGroups?: (groupIds: { archivedAt: string; surveyId: string }[]) => void;
  onRestoreArchivedResponseGroups?: (groupIds: { archivedAt: string; surveyId: string }[]) => void;
  onImportArchivedResponses?: (file: File) => Promise<ArchiveImportResult>;
  isAdmin: boolean;
}

export function ArchivePage({
  surveys,
  archivedResponses,
  archiveSeries = [],
  onRenameArchiveSeries,
  onUpdateSurvey,
  onRestoreResponseGroup,
  onRestoreResponsesForSurvey,
  onDeleteArchivedResponseGroups,
  onRestoreArchivedResponseGroups,
  onImportArchivedResponses,
  isAdmin
}: ArchivePageProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'surveys' | 'responses'>('surveys');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmSurvey, setConfirmSurvey] = useState<CustomForm | null>(null);
  const [confirmResponseGroup, setConfirmResponseGroup] = useState<{ responseId: string; company: string; type: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter archived surveys
  const archivedSurveys = useMemo(() => {
    return surveys.filter((s) => s.status === 'Archived');
  }, [surveys]);

  // Group responses primarily by named archive series (a period like "1st Half
  // 2026" can span multiple archive actions/surveys done under the same
  // label). Rows with no seriesId (pre-existing data from before series
  // existed) fall back to the old per-event grouping so nothing breaks.
  const groupedArchivedResponses = useMemo(() => {
    const seriesById = new Map(archiveSeries.map((s) => [s.id, s]));
    const groups: Record<string, {
      id: string;
      label: string;
      seriesId?: string;
      surveyTypes: SurveyType[];
      sortKey: string;
      // Distinct (archivedAt, surveyId) event pairs contributing to this
      // group - needed because a series can merge multiple archive events.
      eventKeys: { archivedAt: string; surveyId: string }[];
      responsesCount: number;
      responses: SurveyResponse[];
    }> = {};

    archivedResponses.forEach((r) => {
      const seriesId = r.seriesId && seriesById.has(r.seriesId) ? r.seriesId : undefined;
      // Use fallback for older data that doesn't have these properties
      const legacySurveyId = r.archivedBySurveyId || r.surveyType;
      const legacyArchivedAt = r.archivedAt || r.submissionDate;
      const groupId = seriesId ?? `legacy_${legacySurveyId}_${legacyArchivedAt}`;
      const label = seriesId ? seriesById.get(seriesId)!.label : (r.archivedBySurveyTitle || r.surveyType + ' Form');
      const sortKey = seriesId ? seriesById.get(seriesId)!.createdAt : legacyArchivedAt;

      if (!groups[groupId]) {
        groups[groupId] = {
          id: groupId,
          label,
          seriesId,
          surveyTypes: [],
          sortKey,
          eventKeys: [],
          responsesCount: 0,
          responses: [],
        };
      }

      if (!groups[groupId].surveyTypes.includes(r.surveyType)) {
        groups[groupId].surveyTypes.push(r.surveyType);
      }
      if (!groups[groupId].eventKeys.some((e) => e.archivedAt === legacyArchivedAt && e.surveyId === legacySurveyId)) {
        groups[groupId].eventKeys.push({ archivedAt: legacyArchivedAt, surveyId: legacySurveyId });
      }

      // Calculate responsesCount properly (number of unique responseIds)
      const isUniqueResponse = !groups[groupId].responses.some(resp => resp.responseId === r.responseId);
      if (isUniqueResponse) {
        groups[groupId].responsesCount += 1;
      }

      groups[groupId].responses.push(r);
    });

    return Object.values(groups).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [archivedResponses, archiveSeries]);

  // Handle restoring an archived survey back to active/running status
  const handleRestoreSurvey = (survey: CustomForm) => {
    setConfirmSurvey(survey);
  };

  const executeRestoreSurvey = () => {
    if (!confirmSurvey || !onUpdateSurvey) return;
    onUpdateSurvey({
      ...confirmSurvey,
      status: 'Running'
    });
    setSuccessMessage(`Form "${confirmSurvey.title}" has been restored to Active status!`);
    setConfirmSurvey(null);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleRestoreResponseGroup = (group: { responseId: string; company: string; type: string }) => {
    setConfirmResponseGroup(group);
  };

  const executeRestoreResponseGroup = () => {
    if (!confirmResponseGroup || !onRestoreResponseGroup) return;
    onRestoreResponseGroup(confirmResponseGroup.responseId);
    setSuccessMessage(`Evaluations for "${confirmResponseGroup.company}" restored to live dataset!`);
    setConfirmResponseGroup(null);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Filter lists based on search
  const filteredArchivedSurveys = useMemo(() => {
    if (!searchQuery.trim()) return archivedSurveys;
    const needle = searchQuery.toLowerCase();
    return archivedSurveys.filter(
      (s) => s.title.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle)
    );
  }, [archivedSurveys, searchQuery]);

  const filteredGroupedResponses = useMemo(() => {
    if (!searchQuery.trim()) return groupedArchivedResponses;
    const needle = searchQuery.toLowerCase();
    return groupedArchivedResponses.filter(
      (g) =>
        g.label.toLowerCase().includes(needle) ||
        g.surveyTypes.some((t) => t.toLowerCase().includes(needle))
    );
  }, [groupedArchivedResponses, searchQuery]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  // "Series Trend" panel state: overall trend across periods, or one
  // company's trend across periods (the "project a company's rating trend
  // across years" view).
  const [trendCompany, setTrendCompany] = useState<string>('__overall__');
  const trendCompanies = useMemo(
    () => [...new Set(archivedResponses.filter((r) => r.seriesId).map((r) => r.company))].sort(),
    [archivedResponses]
  );
  const seriesTrendData = useMemo(() => {
    const data = trendCompany === '__overall__'
      ? seriesTrend(archivedResponses, archiveSeries)
      : companySeriesTrend(archivedResponses, trendCompany, archiveSeries);
    return data.map((d) => ({ key: d.label, average: d.average, responses: d.responses }));
  }, [archivedResponses, archiveSeries, trendCompany]);

  const startRenameSeries = (seriesId: string, currentLabel: string) => {
    setEditingSeriesId(seriesId);
    setEditingLabel(currentLabel);
  };

  const commitRenameSeries = () => {
    if (editingSeriesId && onRenameArchiveSeries && editingLabel.trim()) {
      onRenameArchiveSeries(editingSeriesId, editingLabel.trim());
    }
    setEditingSeriesId(null);
    setEditingLabel('');
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedGroups(next);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedGroups(next);
  };

  const selectAll = () => {
    if (selectedGroups.size === filteredGroupedResponses.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(filteredGroupedResponses.map(g => g.id)));
    }
  };

  const [confirmDeleteState, setConfirmDeleteState] = useState<{isOpen: boolean}>({ isOpen: false });

  // Export/import of raw archived response data (see archiveResponseTransfer.ts)
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ArchiveImportResult | null>(null);
  const [importError, setImportError] = useState('');

  const handleExportSelected = () => {
    const rows = groupedArchivedResponses
      .filter((g) => selectedGroups.has(g.id))
      .flatMap((g) => g.responses);
    if (rows.length === 0) return;
    exportArchivedResponsesAsExcel(rows, 'archived_responses_selected', archiveSeries);
  };

  const handleExportAll = () => {
    if (archivedResponses.length === 0) return;
    exportArchivedResponsesAsExcel(archivedResponses, 'archived_responses_all', archiveSeries);
  };

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onImportArchivedResponses) return;

    setIsImporting(true);
    setImportError('');
    setImportResult(null);
    try {
      const result = await onImportArchivedResponses(file);
      setImportResult(result);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import the archived responses file.');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadImportLog = () => {
    if (!importResult) return;
    const blob = new Blob([JSON.stringify(importResult.log, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive-import-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkRestore = () => {
    if (selectedGroups.size === 0 || !onRestoreArchivedResponseGroups) return;
    const groups = filteredGroupedResponses
      .filter(g => selectedGroups.has(g.id))
      .flatMap(g => g.eventKeys);

    onRestoreArchivedResponseGroups(groups);
    setSelectedGroups(new Set());
    setSuccessMessage('Selected archived forms have been restored to live dataset!');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleBulkDelete = () => {
    if (selectedGroups.size === 0 || !onDeleteArchivedResponseGroups) return;
    setConfirmDeleteState({ isOpen: true });
  };

  const confirmBulkDelete = () => {
    const groups = filteredGroupedResponses
      .filter(g => selectedGroups.has(g.id))
      .flatMap(g => g.eventKeys);

    onDeleteArchivedResponseGroups!(groups);
    setSelectedGroups(new Set());
    setConfirmDeleteState({ isOpen: false });
    setSuccessMessage('Selected archived logs have been permanently deleted.');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  if (!isAdmin) {
    return (
      <div className="panel mx-auto mt-10 max-w-md p-5 text-center text-slate-500 sm:p-8">
        <Trash2 className="mx-auto mb-4 text-rose-500 h-12 w-12" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Access Restricted</h3>
        <p className="text-sm mt-2">Only administrators can access the Archive Center.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50 rounded-xl p-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-sm animate-fade-in">
          <RefreshCw size={18} className="animate-spin-slow text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Two Clickable Blocks (Bento Cards) */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Block 1: Archived Survey */}
        <button
          onClick={() => {
            setActiveTab('surveys');
            setSearchQuery('');
          }}
          className={`panel p-6 flex items-start gap-4 text-left transition relative overflow-hidden cursor-pointer ${
            activeTab === 'surveys'
              ? 'ring-2 ring-[#0063a9] bg-blue-50/20 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900'
              : 'hover:border-slate-300 hover:bg-slate-50/30'
          }`}
          id="btn-archive-surveys"
        >
          <div className={`p-3 rounded-xl shrink-0 ${
            activeTab === 'surveys' ? 'bg-[#0063a9] text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            <ClipboardList size={24} />
          </div>
          <div className="space-y-1 flex-1 pr-12">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">Archived Surveys</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              Form templates removed from active rotation. Can be restored back to the active registry.
            </p>
          </div>
          <span className="absolute top-6 right-6 inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-black text-slate-700 dark:text-slate-300">
            {archivedSurveys.length}
          </span>
        </button>

        {/* Block 2: Archived Responses */}
        <button
          onClick={() => {
            setActiveTab('responses');
            setSearchQuery('');
          }}
          className={`panel p-6 flex items-start gap-4 text-left transition relative overflow-hidden cursor-pointer ${
            activeTab === 'responses'
              ? 'ring-2 ring-[#0063a9] bg-blue-50/20 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900'
              : 'hover:border-slate-300 hover:bg-slate-50/30'
          }`}
          id="btn-archive-responses"
        >
          <div className={`p-3 rounded-xl shrink-0 ${
            activeTab === 'responses' ? 'bg-[#0063a9] text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            <FileText size={24} />
          </div>
          <div className="space-y-1 flex-1 pr-12">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">Archived Responses</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              Submissions preserved from completed or reset evaluations. Keeps your live dashboards neat.
            </p>
          </div>
          <span className="absolute top-6 right-6 inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-black text-slate-700 dark:text-slate-300">
            {groupedArchivedResponses.length}
          </span>
        </button>
      </div>

      {/* List Container with Search */}
      <div className="panel p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {activeTab === 'surveys' ? 'Archived Surveys Directory' : 'Archived Responses Logs'}
          </h2>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {activeTab === 'responses' && (
              <div className="flex items-center gap-2">
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportFileSelected}
                />
                <button
                  type="button"
                  onClick={() => importFileInputRef.current?.click()}
                  disabled={isImporting}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                  title="Re-import a previously exported archived-responses file"
                >
                  {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span>{isImporting ? 'Importing…' : 'Import'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportAll}
                  disabled={archivedResponses.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60 cursor-pointer"
                  title="Export every archived response to Excel"
                >
                  <Download size={14} />
                  <span>Export All Archived</span>
                </button>
              </div>
            )}

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
              <input
                type="text"
                placeholder={`Search archived ${activeTab === 'surveys' ? 'surveys' : 'responses'}...`}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-9 py-2 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#0063a9]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {importError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 text-xs font-semibold flex items-center gap-2 dark:bg-rose-950/20 dark:border-rose-900">
            <span>{importError}</span>
          </div>
        )}

        {/* Tab 1 Content: Surveys List */}
        {activeTab === 'surveys' && (
          <div>
            {filteredArchivedSurveys.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <Archive size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No archived surveys found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[640px] border-collapse text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                      <th className="px-4 py-3">Survey Title</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Date Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredArchivedSurveys.map((survey) => (
                      <tr key={survey.id} className="align-middle hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                        <td className="px-4 py-4">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {survey.title}
                            </span>
                            <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1">
                              {survey.description || 'No description.'}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {survey.surveyType}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
                          {new Date(survey.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => handleRestoreSurvey(survey)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#0063a9] text-[#0063a9] hover:bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-950/20 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                            type="button"
                          >
                            <RefreshCw size={12} />
                            <span>Restore Form</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2 Content: Responses List */}
        {activeTab === 'responses' && (
          <div className="space-y-5">
            {archiveSeries.length > 0 && (
              <ChartCard
                title="Series Trend"
                subtitle="Average score across named archive periods - track a company (or the overall portfolio) year over year"
                action={
                  <div className="flex items-center gap-1.5 text-xs">
                    <TrendingUp size={14} className="text-slate-400" />
                    <select
                      value={trendCompany}
                      onChange={(e) => setTrendCompany(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0063a9] cursor-pointer"
                    >
                      <option value="__overall__">Overall (all companies)</option>
                      {trendCompanies.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                }
              >
                {seriesTrendData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                    No data for this selection.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={seriesTrendData} margin={{ top: 8, right: isMobile ? 0 : 8, left: isMobile ? -8 : 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="key" minTickGap={isMobile ? 20 : 8} tick={{ fontSize: isMobile ? 9 : 12 }} />
                      <YAxis yAxisId="left" domain={[0, 100]} width={isMobile ? 34 : 48} tickFormatter={(value: number) => `${value}%`} tick={{ fontSize: isMobile ? 9 : 12 }} />
                      <YAxis yAxisId="right" orientation="right" width={isMobile ? 28 : 48} allowDecimals={false} tick={{ fontSize: isMobile ? 9 : 12 }} />
                      <Tooltip formatter={(value, name) => [name === 'Average Score' ? `${value}%` : value, name]} />
                      <Line yAxisId="left" type="monotone" dataKey="average" name="Average Score" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                      <Line yAxisId="right" type="monotone" dataKey="responses" name="Responses" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            )}

            {filteredGroupedResponses.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No archived responses found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Bulk Actions Bar */}
                {selectedGroups.size > 0 && (
                  <div className="bg-[#0063a9]/10 border border-[#0063a9]/20 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                    <span className="text-sm font-bold text-[#0063a9] dark:text-blue-400">
                      {selectedGroups.size} group(s) selected
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={handleExportSelected} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#0063a9]/30 bg-white dark:bg-slate-900 text-[#0063a9] hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer">
                        Export Selected
                      </button>
                      <button onClick={handleBulkRestore} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#0063a9] text-white hover:bg-[#00528c] transition cursor-pointer">
                        Restore Selected
                      </button>
                      <button onClick={handleBulkDelete} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer">
                        Delete Selected
                      </button>
                      <button onClick={() => setSelectedGroups(new Set())} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Select All Checkbox */}
                <div className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={selectedGroups.size === filteredGroupedResponses.length && filteredGroupedResponses.length > 0}
                    onChange={selectAll}
                    className="w-4 h-4 rounded border-slate-300 text-[#0063a9] focus:ring-[#0063a9]"
                  />
                  <span>Select All ({filteredGroupedResponses.length})</span>
                </div>

                {filteredGroupedResponses.map((group) => {
                  const isExpanded = expandedGroups.has(group.id);
                  const isSelected = selectedGroups.has(group.id);
                  
                  return (
                    <div key={group.id} className={`rounded-xl border transition ${isSelected ? 'border-[#0063a9] bg-blue-50/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                      <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(group.id)}
                            className="w-4 h-4 rounded border-slate-300 text-[#0063a9] focus:ring-[#0063a9]"
                          />
                          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500">
                            <ClipboardList size={20} />
                          </div>
                          <div>
                            {editingSeriesId === group.seriesId && group.seriesId ? (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editingLabel}
                                  autoFocus
                                  onChange={(e) => setEditingLabel(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitRenameSeries();
                                    if (e.key === 'Escape') { setEditingSeriesId(null); setEditingLabel(''); }
                                  }}
                                  className="rounded-lg border border-[#0063a9] bg-white dark:bg-slate-950 px-2 py-1 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={commitRenameSeries}
                                  className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                                  aria-label="Save period name"
                                >
                                  <Check size={14} />
                                </button>
                              </div>
                            ) : (
                              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                {group.label}
                                {group.seriesId && onRenameArchiveSeries && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); startRenameSeries(group.seriesId!, group.label); }}
                                    className="text-slate-300 hover:text-[#0063a9] dark:text-slate-600 dark:hover:text-blue-400 cursor-pointer"
                                    aria-label="Rename period"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                )}
                              </h4>
                            )}
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                              {group.surveyTypes.map((t) => (
                                <span key={t} className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {t}
                                </span>
                              ))}
                              <span>•</span>
                              <Calendar size={12} />
                              <span>{group.seriesId ? 'Period created' : 'Archived'}: {new Date(group.sortKey).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-lg font-black text-slate-900 dark:text-white">{group.responsesCount}</div>
                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Responses</div>
                          </div>
                          <button
                            onClick={() => toggleExpand(group.id)}
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            {isExpanded ? 'Hide Logs' : 'View Logs'}
                          </button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950/50 space-y-4">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Actual Logs & Scores</h5>
                          <div className="space-y-3">
                            {/* Group logs by responseId internally for display */}
                            {Array.from(new Set(group.responses.map(r => r.responseId))).map(respId => {
                              const answers = group.responses.filter(r => r.responseId === respId);
                              const first = answers[0];
                              return (
                                <div key={respId} className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-800 shadow-sm text-xs space-y-2">
                                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                      <Building2 size={14} className="text-[#0063a9]" />
                                      {first.company}
                                    </div>
                                    <div className="text-slate-500 flex items-center gap-1">
                                      <UserCheck size={12} /> {first.respondentType}
                                    </div>
                                  </div>
                                  <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {answers.map(ans => (
                                      <div key={ans.questionId} className="py-1.5 flex justify-between gap-4">
                                        <span className="text-slate-600 dark:text-slate-400 truncate max-w-sm">Q{ans.questionNumber}. {ans.question}</span>
                                        <div className="text-right shrink-0">
                                          <span className="font-bold text-[#0063a9]">{ans.rating}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Overlays */}
      {confirmSurvey && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="confirm-restore-survey-modal">
          <div className="bg-white dark:bg-slate-950 rounded-2xl max-w-md w-full border border-slate-100 dark:border-slate-800/80 p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-[#0063a9] dark:text-blue-400 rounded-xl shrink-0">
                <RefreshCw size={24} className="animate-spin-slow" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Restore Survey Form?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Are you sure you want to restore the survey form <strong>"{confirmSurvey.title}"</strong> back to Active/Running status? Respondents will immediately be able to see and submit evaluations for this form.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmSurvey(null)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer transition"
                id="btn-cancel-restore-survey"
              >
                Cancel
              </button>
              <button
                onClick={executeRestoreSurvey}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-[#0063a9] hover:bg-[#00528c] text-white cursor-pointer transition"
                id="btn-confirm-restore-survey"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmResponseGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="confirm-restore-response-modal">
          <div className="bg-white dark:bg-slate-950 rounded-2xl max-w-md w-full border border-slate-100 dark:border-slate-800/80 p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                <RefreshCw size={24} className="animate-spin-slow" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Restore Submissions?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Are you sure you want to restore this evaluation submission for <strong>"{confirmResponseGroup.company}"</strong> back into the active database? This will immediately merge these scores back into your live charts and dashboards.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmResponseGroup(null)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer transition"
                id="btn-cancel-restore-responses"
              >
                Cancel
              </button>
              <button
                onClick={executeRestoreResponseGroup}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition"
                id="btn-confirm-restore-responses"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="confirm-bulk-delete-modal">
          <div className="bg-white dark:bg-slate-950 rounded-2xl max-w-md w-full border border-rose-100 dark:border-rose-900/30 p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
                <Trash2 size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Permanently Delete?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Are you sure you want to permanently delete {selectedGroups.size} archived logs? This action cannot be undone.
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 pt-1">
                  Tip: use "Export Selected" first if you want an Excel backup you can re-import later.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteState({ isOpen: false })}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDelete}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer transition"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Result Modal */}
      {importResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-950 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 p-6 shadow-xl relative">
            <button
              onClick={() => setImportResult(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
              type="button"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 text-emerald-600">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Archive Import Complete</h3>
                <p className="text-xs text-slate-500">{importResult.stats.totalRows} rows processed</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 text-xs min-[420px]:grid-cols-3">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900">
                <span className="text-emerald-700 dark:text-emerald-400 font-medium block">Imported</span>
                <strong className="text-emerald-800 dark:text-emerald-300 text-lg">{importResult.stats.imported}</strong>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-medium block">Duplicates skipped</span>
                <strong className="text-slate-800 dark:text-slate-100 text-lg">{importResult.stats.skippedDuplicate}</strong>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-100 dark:border-rose-900">
                <span className="text-rose-600 font-medium block">Invalid rows</span>
                <strong className="text-rose-700 dark:text-rose-300 text-lg">{importResult.stats.skippedInvalid}</strong>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
              Imported rows are always restored as archived data. Download the full log to see exactly which rows were imported, skipped as duplicates, or rejected as invalid.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                onClick={downloadImportLog}
                className="secondary-button text-xs py-2 px-4 flex items-center gap-1.5"
                type="button"
              >
                <FileText size={14} />
                <span>Download Import Log</span>
              </button>
              <button
                onClick={() => setImportResult(null)}
                className="bg-[#0063a9] hover:bg-[#00528c] text-white text-xs font-bold py-2 px-4 rounded-lg transition cursor-pointer"
                type="button"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
