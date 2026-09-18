import { useRef, useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Package,
  HardHat,
  X,
  UserPlus,
  SkipForward,
  Building2,
} from 'lucide-react';
import { SurveyType } from '../types/survey';
import { RawEvalImportSummary, RawEvalPreview, CompanyDecision } from '../utils/rawEvaluationImport';

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

function hasAcceptedExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface ImportEvaluationsPageProps {
  onPreview: (file: File, surveyType: SurveyType) => Promise<RawEvalPreview>;
  onCommit: (preview: RawEvalPreview, decisions: Record<string, CompanyDecision>) => RawEvalImportSummary;
}

interface CardState {
  isImporting: boolean;
  result: RawEvalImportSummary | null;
  error: string;
  pendingPreview: RawEvalPreview | null;
  decisions: Record<string, CompanyDecision>;
  stagedFile: File | null;
}

function emptyCardState(): CardState {
  return { isImporting: false, result: null, error: '', pendingPreview: null, decisions: {}, stagedFile: null };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FORM_CARDS: { surveyType: SurveyType; title: string; formLabel: string; icon: typeof Package }[] = [
  { surveyType: 'Supplier', title: 'Supplier', formLabel: 'Form 20-002, Form 2', icon: Package },
  { surveyType: 'Subcontractor', title: 'Subcontractor', formLabel: 'Form 20-002, Form 3', icon: HardHat },
  { surveyType: 'Courier', title: 'Courier', formLabel: 'Form 20-002, Form 4', icon: Truck },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ImportEvaluationsPage({ onPreview, onCommit }: ImportEvaluationsPageProps) {
  const [state, setState] = useState<Record<SurveyType, CardState>>({
    Supplier: emptyCardState(),
    Subcontractor: emptyCardState(),
    Courier: emptyCardState(),
  });

  const [dragOverType, setDragOverType] = useState<SurveyType | null>(null);
  const dragCounters = useRef<Record<SurveyType, number>>({ Supplier: 0, Subcontractor: 0, Courier: 0 });

  const fileInputs = {
    Supplier: useRef<HTMLInputElement>(null),
    Subcontractor: useRef<HTMLInputElement>(null),
    Courier: useRef<HTMLInputElement>(null),
  };

  const patchCard = (surveyType: SurveyType, patch: Partial<CardState>) => {
    setState((prev) => ({ ...prev, [surveyType]: { ...prev[surveyType], ...patch } }));
  };

  const runCommit = (surveyType: SurveyType, preview: RawEvalPreview, decisions: Record<string, CompanyDecision>) => {
    patchCard(surveyType, { isImporting: true, pendingPreview: null, error: '' });
    try {
      const summary = onCommit(preview, decisions);
      patchCard(surveyType, { isImporting: false, result: summary });
    } catch (err) {
      patchCard(surveyType, { isImporting: false, error: err instanceof Error ? err.message : 'Failed to import this file.' });
    }
  };

  const processFile = async (surveyType: SurveyType, file: File) => {
    patchCard(surveyType, { isImporting: true, result: null, error: '', pendingPreview: null });
    try {
      const preview = await onPreview(file, surveyType);
      const unmatched = preview.companyMatches.filter((m) => m.status === 'unmatched');

      if (unmatched.length === 0) {
        runCommit(surveyType, preview, {});
        return;
      }

      const defaults: Record<string, CompanyDecision> = {};
      unmatched.forEach((m) => { defaults[m.normalizedName] = 'add-as-partner'; });
      patchCard(surveyType, { isImporting: false, pendingPreview: preview, decisions: defaults });
    } catch (err) {
      patchCard(surveyType, { isImporting: false, error: err instanceof Error ? err.message : 'Failed to read this file.' });
    }
  };

  // Selecting/dropping a file only stages it - nothing is parsed or imported
  // until the admin confirms with the Import button, so picking the wrong
  // file is a one-click undo (the X) instead of an already-started import.
  const stageFile = (surveyType: SurveyType, file: File) => {
    if (!hasAcceptedExtension(file.name)) {
      patchCard(surveyType, { error: `"${file.name}" isn't an Excel or CSV file (.xlsx/.xls/.csv).`, stagedFile: null });
      return;
    }
    patchCard(surveyType, { stagedFile: file, error: '', result: null });
  };

  const clearStagedFile = (surveyType: SurveyType) => {
    patchCard(surveyType, { stagedFile: null });
  };

  const confirmStagedImport = async (surveyType: SurveyType) => {
    const file = state[surveyType].stagedFile;
    if (!file) return;
    patchCard(surveyType, { stagedFile: null });
    await processFile(surveyType, file);
  };

  const handleFileSelected = (surveyType: SurveyType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    stageFile(surveyType, file);
  };

  const handleDragEnter = (surveyType: SurveyType, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounters.current[surveyType] += 1;
    setDragOverType(surveyType);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (surveyType: SurveyType, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounters.current[surveyType] = Math.max(0, dragCounters.current[surveyType] - 1);
    if (dragCounters.current[surveyType] === 0) {
      setDragOverType((current) => (current === surveyType ? null : current));
    }
  };

  const handleDrop = (surveyType: SurveyType, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounters.current[surveyType] = 0;
    setDragOverType((current) => (current === surveyType ? null : current));

    const file = e.dataTransfer.files?.[0];
    if (!file || state[surveyType].isImporting) return;
    stageFile(surveyType, file);
  };

  // The three forms are one conceptual batch (one evaluation period, three
  // subcategories) rather than three independent imports, so there's a
  // single "Import" action that runs whichever cards currently have a
  // staged file - each still resolves through its own preview/decision/
  // commit flow independently, they just all kick off together.
  const stagedCards = FORM_CARDS.filter(({ surveyType }) => state[surveyType].stagedFile);
  const anyImporting = FORM_CARDS.some(({ surveyType }) => state[surveyType].isImporting);

  const handleImportAll = () => {
    stagedCards.forEach(({ surveyType }) => confirmStagedImport(surveyType));
  };

  const modalSurveyType = FORM_CARDS.find(({ surveyType }) => state[surveyType].pendingPreview)?.surveyType ?? null;
  const modalCard = modalSurveyType ? state[modalSurveyType] : null;
  const modalUnmatched = modalCard?.pendingPreview?.companyMatches.filter((m) => m.status === 'unmatched') ?? [];

  const setDecision = (surveyType: SurveyType, key: string, decision: CompanyDecision) => {
    setState((prev) => ({
      ...prev,
      [surveyType]: { ...prev[surveyType], decisions: { ...prev[surveyType].decisions, [key]: decision } },
    }));
  };

  const setAllDecisions = (surveyType: SurveyType, decision: CompanyDecision) => {
    setState((prev) => {
      const keys = Object.keys(prev[surveyType].decisions);
      const next: Record<string, CompanyDecision> = {};
      keys.forEach((k) => { next[k] = decision; });
      return { ...prev, [surveyType]: { ...prev[surveyType], decisions: next } };
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <FileSpreadsheet size={20} />
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
            Import Evaluation Responses
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
          Stage the Supplier, Subcontractor, and Courier exports for one evaluation period below, then import them
          together as a single batch. Company names are matched against the full Partner Registry (any
          classification or archive state), and each source row's own "ID" column keeps re-uploads idempotent -
          importing a refreshed export updates the same rows instead of duplicating them.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {FORM_CARDS.map(({ surveyType, title, formLabel, icon: Icon }) => {
          const card = state[surveyType];
          const isDragOver = dragOverType === surveyType;
          return (
            <div
              key={surveyType}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col"
            >
              <div className="flex items-center gap-3 mb-1">
                <span className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0063a9] dark:text-blue-400">
                  <Icon size={18} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">{title} Evaluations</h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{formLabel}</p>
                </div>
              </div>

              <input
                ref={fileInputs[surveyType]}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleFileSelected(surveyType, e)}
              />

              {card.stagedFile ? (
                <div className="mt-5 rounded-xl border-2 border-dashed border-[#0063a9]/40 bg-blue-50/40 dark:bg-blue-950/10 p-4">
                  <div className="flex items-start gap-3">
                    <span className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[#0063a9] dark:text-blue-400 shrink-0">
                      <FileSpreadsheet size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate" title={card.stagedFile.name}>
                        {card.stagedFile.name}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {formatFileSize(card.stagedFile.size)} - ready to import
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => clearStagedFile(surveyType)}
                      disabled={card.isImporting}
                      title="Remove this file"
                      className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragEnter={(e) => handleDragEnter(surveyType, e)}
                  onDragOver={handleDragOver}
                  onDragLeave={(e) => handleDragLeave(surveyType, e)}
                  onDrop={(e) => handleDrop(surveyType, e)}
                  onClick={() => !card.isImporting && fileInputs[surveyType].current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !card.isImporting) {
                      e.preventDefault();
                      fileInputs[surveyType].current?.click();
                    }
                  }}
                  aria-disabled={card.isImporting}
                  className={`mt-5 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors duration-150 ${
                    card.isImporting
                      ? 'cursor-wait opacity-60 border-slate-200 dark:border-slate-800'
                      : isDragOver
                      ? 'cursor-copy border-[#0063a9] bg-blue-50/60 dark:bg-blue-950/30'
                      : 'cursor-pointer border-slate-200 dark:border-slate-700 hover:border-[#0063a9]/60 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                  }`}
                >
                  {card.isImporting ? (
                    <Loader2 size={20} className="animate-spin text-[#0063a9] dark:text-blue-400" />
                  ) : (
                    <UploadCloud size={20} className={isDragOver ? 'text-[#0063a9] dark:text-blue-400' : 'text-slate-400'} />
                  )}
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {card.isImporting ? 'Importing…' : isDragOver ? 'Drop to import' : 'Drag & drop Excel or CSV file here'}
                  </p>
                  {!card.isImporting && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      or <span className="font-semibold text-[#0063a9] dark:text-blue-400">browse (.xlsx/.xls/.csv)</span>
                    </p>
                  )}
                </div>
              )}

              {card.error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 px-3 py-2.5 text-[11px] text-rose-700 dark:text-rose-400">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{card.error}</span>
                </div>
              )}

              {card.result && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={15} className="shrink-0" />
                    <span className="text-xs font-bold">Import complete</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs min-[420px]:grid-cols-2">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider">Submissions</span>
                      <strong className="text-slate-800 dark:text-slate-100 text-base">{card.result.imported}</strong>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider">Rows in file</span>
                      <strong className="text-slate-800 dark:text-slate-100 text-base">{card.result.totalRows}</strong>
                    </div>
                    {card.result.replaced > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900 col-span-2">
                        <span className="text-amber-700 dark:text-amber-400 font-medium block text-[10px] uppercase tracking-wider">Replaced (re-import)</span>
                        <strong className="text-amber-800 dark:text-amber-300 text-base">{card.result.replaced}</strong>
                      </div>
                    )}
                  </div>

                  {card.result.dateRange && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Covers {formatDate(card.result.dateRange.earliest)} - {formatDate(card.result.dateRange.latest)}
                    </p>
                  )}

                  {card.result.skippedBlank > 0 && (
                    <p className="text-[11px] text-slate-400">{card.result.skippedBlank} blank row(s) skipped.</p>
                  )}

                  {card.result.missingRespondentInfo > 0 && (
                    <p className="text-[11px] text-slate-400">
                      {card.result.missingRespondentInfo} row(s) had no designation/department on file and were marked "Unspecified".
                    </p>
                  )}

                  {card.result.needsReclassification.length > 0 && (
                    <div className="rounded-lg border border-sky-200 dark:border-sky-900/50 bg-sky-50 dark:bg-sky-950/10 p-3">
                      <p className="text-[11px] font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                        <Building2 size={12} />
                        {card.result.needsReclassification.length} matched compan{card.result.needsReclassification.length === 1 ? 'y needs' : 'ies need'} reclassification
                      </p>
                      <p className="text-[10px] text-sky-600/80 dark:text-sky-400/70 mt-1">
                        Found in the Partner Registry under a different classification. Responses were still imported
                        under their registry name - update the company's type in Partner Companies to fully activate it:
                      </p>
                      <ul className="mt-1.5 space-y-0.5 max-h-28 overflow-y-auto pr-1">
                        {card.result.needsReclassification.map((n) => (
                          <li key={n.canonicalName} className="text-[11px] text-sky-800 dark:text-sky-300 truncate">
                            - {n.canonicalName} <span className="text-sky-500/80">({n.currentType}{n.isArchived ? ', archived' : ''})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {card.result.addedCompanies.length > 0 && (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/10 p-3">
                      <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <UserPlus size={12} />
                        {card.result.addedCompanies.length} new partner{card.result.addedCompanies.length === 1 ? '' : 's'} added
                      </p>
                      <p className="text-[10px] text-amber-600/80 dark:text-amber-400/70 mt-1">
                        Added with just a name - insufficient data yet. Fill in address/contact/email in Partner Companies:
                      </p>
                      <ul className="mt-1.5 space-y-0.5 max-h-28 overflow-y-auto pr-1">
                        {card.result.addedCompanies.map((name) => (
                          <li key={name} className="text-[11px] text-amber-800 dark:text-amber-300 truncate">- {name}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {card.result.skippedCompanies.length > 0 && (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <SkipForward size={12} />
                        {card.result.skippedCompanies.length} company/ies skipped (not imported)
                      </p>
                      <ul className="mt-1.5 space-y-0.5 max-h-24 overflow-y-auto pr-1">
                        {card.result.skippedCompanies.map((name) => (
                          <li key={name} className="text-[11px] text-slate-500 dark:text-slate-400 truncate">- {name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {stagedCards.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <strong className="text-slate-700 dark:text-slate-200">{stagedCards.length}</strong> of 3 file{stagedCards.length === 1 ? '' : 's'} staged for this batch -{' '}
            {stagedCards.map(({ title }) => title).join(', ')}
          </p>
          <button
            type="button"
            onClick={handleImportAll}
            disabled={anyImporting}
            className="self-end sm:self-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0063a9] hover:bg-[#00528c] disabled:opacity-60 disabled:cursor-wait px-5 py-2.5 text-xs font-bold text-white shadow-md transition cursor-pointer"
          >
            {anyImporting ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            {anyImporting ? 'Importing…' : stagedCards.length > 1 ? `Import (${stagedCards.length})` : 'Import'}
          </button>
        </div>
      )}

      {modalSurveyType && modalCard?.pendingPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-transparent dark:bg-slate-950 relative animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <button
              onClick={() => patchCard(modalSurveyType, { pendingPreview: null })}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
              title="Cancel import"
              type="button"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 text-amber-600 shrink-0">
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Companies not found</h3>
                <p className="text-xs text-slate-500">
                  {modalUnmatched.length} name{modalUnmatched.length === 1 ? '' : 's'} in this file don't match anyone in the Partner Registry
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 shrink-0">
              Skip a company to leave its evaluation rows out of this import, or add it as a new partner (with just a
              name - you'll fill in the rest later) so its responses still count toward analytics.
            </p>

            <div className="flex items-center gap-2 mt-3 shrink-0">
              <button
                type="button"
                onClick={() => setAllDecisions(modalSurveyType, 'add-as-partner')}
                className="text-[11px] font-bold text-[#0063a9] dark:text-blue-400 hover:underline cursor-pointer"
              >
                Add all as partners
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={() => setAllDecisions(modalSurveyType, 'skip')}
                className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
              >
                Skip all
              </button>
            </div>

            <div className="mt-4 space-y-2 overflow-y-auto pr-1 flex-1">
              {modalUnmatched.map((m) => {
                const decision = modalCard.decisions[m.normalizedName] ?? 'add-as-partner';
                return (
                  <div
                    key={m.normalizedName}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2.5"
                  >
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{m.rawName}</span>
                    <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDecision(modalSurveyType, m.normalizedName, 'add-as-partner')}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition cursor-pointer ${
                          decision === 'add-as-partner'
                            ? 'bg-[#0063a9] text-white'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900'
                        }`}
                      >
                        <UserPlus size={11} />
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecision(modalSurveyType, m.normalizedName, 'skip')}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition cursor-pointer ${
                          decision === 'skip'
                            ? 'bg-slate-600 text-white dark:bg-slate-700'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900'
                        }`}
                      >
                        <SkipForward size={11} />
                        Skip
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 mt-5 border-t border-slate-100 dark:border-slate-800 pt-4 shrink-0">
              <button
                onClick={() => patchCard(modalSurveyType, { pendingPreview: null })}
                className="secondary-button py-2 px-4 text-xs"
                type="button"
              >
                Cancel Import
              </button>
              <button
                type="button"
                onClick={() => runCommit(modalSurveyType, modalCard.pendingPreview!, modalCard.decisions)}
                className="bg-[#0063a9] hover:bg-[#00528c] text-white flex items-center justify-center gap-1.5 py-2.5 px-5 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                <CheckCircle2 size={14} />
                Continue Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
