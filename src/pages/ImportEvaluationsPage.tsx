import { useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  HardHat,
  Loader2,
  LockKeyhole,
  Package,
  Truck,
  UploadCloud,
  X,
} from 'lucide-react';
import type { SurveyType } from '../types/survey';
import type { CompanyDecision, RawEvalImportSummary, RawEvalPreview } from '../utils/rawEvaluationImport';
import { archiveEvaluationBatch, validateEvaluationBatchPreviews } from '../features/evaluation-imports/domain/evaluationBatch';
import { detectEvaluationPreviews, normalizeEvaluationFile } from '../features/evaluation-imports/domain/evaluationFilePreview';
import { useEvaluationImportArchives } from '../features/evaluation-imports/hooks/useEvaluationImportArchives';
import { MAX_EVALUATION_IMPORT_FILE_BYTES } from '../features/evaluation-imports/domain/importArchive';
import type { EvaluationImportArchive } from '../features/evaluation-imports/domain/importArchive';
import { createTestImportBatchId, isTestImportArchive } from '../features/evaluation-imports/domain/testImport';
import { useModalEscape } from '../hooks/useModalEscape';
import { PageDescription } from '../components/PageDescription';

const SURVEY_TYPES: SurveyType[] = ['Supplier', 'Subcontractor', 'Courier'];
const FORM_CARDS: Array<{ surveyType: SurveyType; title: string; formLabel: string; icon: typeof Package }> = [
  { surveyType: 'Supplier', title: 'Supplier', formLabel: 'Form 20-002, Form 2', icon: Package },
  { surveyType: 'Subcontractor', title: 'Subcontractor', formLabel: 'Form 20-002, Form 3', icon: HardHat },
  { surveyType: 'Courier', title: 'Courier', formLabel: 'Form 20-002, Form 4', icon: Truck },
];

interface ImportEvaluationsPageProps {
  currentUserEmail: string;
  onPreview: (file: File, surveyType: SurveyType) => Promise<RawEvalPreview>;
  onCommitBatch: (entries: Array<{ preview: RawEvalPreview; decisions: Record<string, CompanyDecision> }>) => Promise<RawEvalImportSummary[]>;
}

interface SelectedEvaluationFile {
  id: string;
  file: File;
  importBatchId: string;
  previews: RawEvalPreview[];
  completedArchive?: EvaluationImportArchive;
  completedSummaries?: RawEvalImportSummary[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function emptyDecisions(): Record<SurveyType, Record<string, CompanyDecision>> {
  return { Supplier: {}, Subcontractor: {}, Courier: {} };
}

export function ImportEvaluationsPage({ currentUserEmail, onPreview, onCommitBatch }: ImportEvaluationsPageProps) {
  const { archives, isLoading: isLoadingArchives, loadError: archiveLoadError, archiveSourceFile, discardPendingArchive, downloadSourceFile, removeTestImport, removeOrdinaryImport } = useEvaluationImportArchives(currentUserEmail);
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedEvaluationFile[]>([]);
  const [decisions, setDecisions] = useState<Record<SurveyType, Record<string, CompanyDecision>>>(emptyDecisions);
  const [summaries, setSummaries] = useState<RawEvalImportSummary[] | null>(null);
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isReviewingCompanies, setIsReviewingCompanies] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [downloadingArchiveId, setDownloadingArchiveId] = useState<string | null>(null);
  const [archiveActionError, setArchiveActionError] = useState('');
  const [archiveActionSuccess, setArchiveActionSuccess] = useState('');
  const [removingArchiveId, setRemovingArchiveId] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'normal' | 'test'>('normal');

  const readyPreviews = selectedFiles.flatMap((item) => item.previews);
  const testReady = readyPreviews.length > 0 && !isScanning;
  const normalReady = testReady;
  const unmatchedCompanies = [...new Map(readyPreviews.flatMap((preview) => preview.companyMatches
    .filter((match) => match.status === 'unmatched')
    .map((match) => [`${preview.surveyType}:${match.normalizedName}`, { surveyType: preview.surveyType, match }] as const))).values()];

  const patchDecision = (surveyType: SurveyType, normalizedName: string, decision: CompanyDecision) => {
    setDecisions((current) => ({
      ...current,
      [surveyType]: { ...current[surveyType], [normalizedName]: decision },
    }));
  };

  const inspectFiles = async (candidates: File[]) => {
    if (isScanning || isImporting || candidates.length === 0) return;
    setError('');
    setIsScanning(true);
    try {
      const added: SelectedEvaluationFile[] = [];
      const existingFiles = summaries ? [] : selectedFiles;
      const seenBatches = new Set(existingFiles.map((item) => item.importBatchId));
      for (const candidate of candidates) {
        const file = normalizeEvaluationFile(candidate);
        if (file.size <= 0 || file.size > MAX_EVALUATION_IMPORT_FILE_BYTES) {
          throw new Error(`"${file.name}" must be between 1 byte and 25 MB.`);
        }
        let parsed: RawEvalPreview[];
        try {
          parsed = await detectEvaluationPreviews(file, onPreview);
        } catch (error) {
          throw new Error(`"${file.name}": ${error instanceof Error ? error.message : 'Unable to read the file.'}`);
        }
        if (parsed.every((preview) => preview.rows.length === 0)) {
          throw new Error(`"${file.name}" has no response rows to import.`);
        }
        const sourceHash = parsed[0]?.importBatchId.slice(parsed[0].importBatchId.lastIndexOf(':') + 1);
        if (!sourceHash) throw new Error(`Unable to identify "${file.name}" for safe re-imports.`);
        const importBatchId = `client-workbook:${sourceHash}`;
        if (seenBatches.has(importBatchId)) throw new Error(`"${file.name}" is already selected. Choose each source file once.`);
        seenBatches.add(importBatchId);
        added.push({
          id: crypto.randomUUID(),
          file,
          importBatchId,
          previews: parsed.map((preview) => ({ ...preview, importBatchId })),
        });
      }
      const nextFiles = [...existingFiles, ...added];
      validateEvaluationBatchPreviews(nextFiles.flatMap((item) => item.previews));
      setSelectedFiles(nextFiles);
      setSummaries(null);
      setDecisions((current) => {
        const base = summaries ? emptyDecisions() : current;
        const next = { ...base, ...Object.fromEntries(SURVEY_TYPES.map((type) => [type, { ...base[type] }])) };
        for (const preview of added.flatMap((item) => item.previews)) {
          for (const match of preview.companyMatches) {
            if (match.status === 'unmatched' && !next[preview.surveyType][match.normalizedName]) {
              next[preview.surveyType][match.normalizedName] = 'add-as-partner';
            }
          }
        }
        return next;
      });
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Unable to inspect selected files.');
    } finally {
      setIsScanning(false);
    }
  };

  const runBatchImport = async (mode: 'normal' | 'test', selectedDecisions = decisions) => {
    if (selectedFiles.length === 0 || (mode === 'test' ? !testReady : !normalReady)) return;
    setIsImporting(true);
    setError('');
    setIsReviewingCompanies(false);
    try {
      const stagedFiles = selectedFiles.map((item) => ({
        ...item,
        importBatchId: mode === 'test' ? createTestImportBatchId() : item.importBatchId,
      }));
      const storedArchives = await archiveEvaluationBatch(
        stagedFiles,
        (item) => archiveSourceFile(item.file, item.previews.length === 1 ? item.previews[0].surveyType : 'Combined', item.importBatchId),
        discardPendingArchive,
      );
      let imported: RawEvalImportSummary[];
      try {
        imported = await onCommitBatch(stagedFiles.flatMap((item) => item.previews.map((preview) => ({
          preview: { ...preview, importBatchId: item.importBatchId },
          decisions: selectedDecisions[preview.surveyType],
        }))));
      } catch (commitError) {
        const reason = commitError instanceof Error ? commitError.message : 'Unknown response write error.';
        throw new Error(`Source files were archived, but the response import failed and may be partial. Refresh before retrying. ${reason}`);
      }
      let summaryIndex = 0;
      setSelectedFiles(selectedFiles.map((item, index) => {
        const completedSummaries = imported.slice(summaryIndex, summaryIndex + item.previews.length);
        summaryIndex += item.previews.length;
        return {
          ...item,
          completedArchive: storedArchives[index],
          completedSummaries,
        };
      }));
      setSummaries(imported);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Unable to archive or import these files.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImport = (mode: 'normal' | 'test') => {
    if (mode === 'test' ? !testReady : !normalReady) return;
    setImportMode(mode);
    if (unmatchedCompanies.length > 0) {
      setIsReviewingCompanies(true);
      return;
    }
    void runBatchImport(mode);
  };

  const forgetCompletedFile = (archive: EvaluationImportArchive) => {
    const remainingFiles = selectedFiles.filter((item) => item.completedArchive?.id !== archive.id);
    if (remainingFiles.length === selectedFiles.length) return;
    setSelectedFiles(remainingFiles);
    const remainingSummaries = remainingFiles.flatMap((item) => item.completedSummaries ?? []);
    setSummaries(remainingSummaries.length ? remainingSummaries : null);
    if (remainingFiles.length === 0) setDecisions(emptyDecisions());
  };

  const handleRemoveTestImport = async (archive: EvaluationImportArchive) => {
    setRemovingArchiveId(archive.id);
    setArchiveActionError('');
    setArchiveActionSuccess('');
    setError('');
    try {
      const removed = await removeTestImport(archive);
      setArchiveActionSuccess(`Test import removed: ${removed.responsesRemoved} submission${removed.responsesRemoved === 1 ? '' : 's'}, ${removed.companiesRemoved} temporary partner${removed.companiesRemoved === 1 ? '' : 's'}, and the stored source file.`);
      forgetCompletedFile(archive);
    } catch (removeError) {
      const message = removeError instanceof Error ? removeError.message : 'Unable to remove the test import. Retry from this list.';
      setArchiveActionError(message);
      setError(message);
    } finally {
      setRemovingArchiveId(null);
    }
  };

  const handleRemoveOrdinaryImport = async (archive: EvaluationImportArchive) => {
    setRemovingArchiveId(archive.id);
    setArchiveActionError('');
    setArchiveActionSuccess('');
    setError('');
    try {
      const removed = await removeOrdinaryImport(archive);
      setArchiveActionSuccess(`Removed ${removed.responsesRemoved} imported submission${removed.responsesRemoved === 1 ? '' : 's'} and stored file "${archive.sourceFileName}".`);
      forgetCompletedFile(archive);
    } catch (removeError) {
      const message = removeError instanceof Error ? removeError.message : 'Unable to remove the stored source file. Retry from this list.';
      setArchiveActionError(message);
      setError(message);
    } finally {
      setRemovingArchiveId(null);
    }
  };

  const handleDownloadArchive = async (archive: EvaluationImportArchive) => {
    setDownloadingArchiveId(archive.id);
    setArchiveActionError('');
    try {
      const blob = await downloadSourceFile(archive);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = archive.sourceFileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setArchiveActionError(downloadError instanceof Error ? downloadError.message : 'Unable to download the archived file.');
    } finally {
      setDownloadingArchiveId(null);
    }
  };

  useModalEscape(isReviewingCompanies, () => setIsReviewingCompanies(false));

  return (
    <div className="space-y-6">
      <PageDescription>
        Upload several CSV or Excel response exports at once. Files can contain Supplier, Subcontractor, or Courier evaluations, including multiple files for the same category.
      </PageDescription>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Evaluation response file upload">
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xls,.csv"
          multiple
          className="hidden"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (selected.length) void inspectFiles(selected);
          }}
        />

        <div
          onDragEnter={(event) => { event.preventDefault(); setIsDragOver(true); }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
          onDragLeave={(event) => { event.preventDefault(); setIsDragOver(false); }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragOver(false);
            void inspectFiles(Array.from(event.dataTransfer.files ?? []));
          }}
          onClick={() => { if (!isScanning && !isImporting) fileInput.current?.click(); }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (!isScanning && !isImporting) fileInput.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-disabled={isScanning || isImporting}
          className={`flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${isDragOver ? 'border-[#0063a9] bg-blue-50/70 dark:bg-blue-950/30' : 'border-slate-200 hover:border-[#0063a9]/60 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900/60'}`}
        >
          <FileSpreadsheet size={38} className="text-emerald-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-white">Drop evaluation response files here</p>
            <p className="mt-1 text-xs text-slate-500">or <span className="font-semibold text-[#0063a9] dark:text-blue-400">browse files</span></p>
          </div>
          <p className="text-[11px] text-slate-400">CSV or Excel (.csv/.xlsx/.xls), up to 25 MB per file</p>
        </div>

        {selectedFiles.length > 0 && (
          <ul className="space-y-2" aria-label="Selected evaluation files">
            {selectedFiles.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"><FileSpreadsheet size={20} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-white" title={item.file.name}>{item.file.name}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(item.file.size)} · {item.previews.map((preview) => `${preview.surveyType}: ${preview.rows.length} responses`).join(' · ')}</p>
                  </div>
                </div>
                {item.completedArchive ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!item.completedArchive) return;
                      if (isTestImportArchive(item.completedArchive)) void handleRemoveTestImport(item.completedArchive);
                      else void handleRemoveOrdinaryImport(item.completedArchive);
                    }}
                    disabled={removingArchiveId !== null || downloadingArchiveId !== null}
                    aria-label={`Remove ${isTestImportArchive(item.completedArchive) ? 'test ' : ''}file ${item.file.name} and its imported responses`}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900 dark:text-rose-400"
                  >
                    {removingArchiveId === item.completedArchive.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <X size={13} aria-hidden="true" />}{isTestImportArchive(item.completedArchive) ? 'Remove test file' : 'Remove file'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setSelectedFiles((current) => summaries ? [] : current.filter((selected) => selected.id !== item.id)); setSummaries(null); setError(''); }}
                    disabled={isScanning || isImporting || removingArchiveId !== null}
                    aria-label={`Remove ${item.file.name} from selection`}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-950/30"
                  ><X size={17} /></button>
                )}
              </li>
            ))}
          </ul>
        )}
        {isScanning && <p role="status" className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Checking selected files…</p>}

        {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-400"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{error}</p>}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {FORM_CARDS.map(({ surveyType, title, formLabel, icon: Icon }) => {
            const categoryPreviews = readyPreviews.filter((preview) => preview.surveyType === surveyType);
            const categorySummaries = summaries?.filter((item) => item.surveyType === surveyType) ?? [];
            return (
              <div key={surveyType} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <span className="rounded-lg bg-blue-50 p-2 text-[#0063a9] dark:bg-blue-950/40 dark:text-blue-400"><Icon size={19} /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">{title} Evaluations</h3>
                    <p className="mt-0.5 text-[11px] text-slate-400">{formLabel}</p>
                  </div>
                  {categoryPreviews.length > 0 && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"><CheckCircle2 size={12} /> {categoryPreviews.length} file{categoryPreviews.length === 1 ? '' : 's'}</span>}
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {categoryPreviews.length > 0 ? (
                    <>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Source files</p>
                      <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto">
                        {categoryPreviews.map((preview) => <li key={preview.importBatchId} className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100" title={`${preview.fileName} · ${preview.sheetName}`}>{preview.fileName} · {preview.rows.length} rows</li>)}
                      </ul>
                      <p className="mt-2 text-[11px] text-slate-500">{categoryPreviews.reduce((total, preview) => total + preview.rows.length, 0)} response rows detected</p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">{isScanning ? 'Looking for this evaluation form…' : selectedFiles.length ? 'Not found in selected files' : 'Form will be detected after selection'}</p>
                  )}
                  {categorySummaries.length > 0 && (
                    <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs dark:bg-emerald-950/20">
                      <p className="font-bold text-emerald-700 dark:text-emerald-400">Import complete · {categorySummaries.reduce((total, summary) => total + summary.imported, 0)} submissions</p>
                      {categorySummaries.some((summary) => summary.replaced > 0) && <p className="mt-1 text-amber-700 dark:text-amber-400">{categorySummaries.reduce((total, summary) => total + summary.replaced, 0)} existing submissions updated</p>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {testReady && !summaries && (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <CalendarDays size={16} className="text-[#0063a9]" />
              <span>{selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} ready across {[...new Set(readyPreviews.map((preview) => preview.surveyType))].join(', ')}.</span>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => handleImport('test')} disabled={isImporting} className="secondary-button min-h-11 px-4 text-xs disabled:opacity-60">
                Test import
              </button>
              {normalReady && <button
                type="button"
                onClick={() => handleImport('normal')}
                disabled={isImporting}
                className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-lg bg-[#0063a9] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#00528c] disabled:cursor-wait disabled:opacity-60 sm:self-auto"
              >
                {isImporting ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                {isImporting ? 'Importing selected files…' : 'Import selected files'}
              </button>}
            </div>
          </div>
        )}

        {summaries && <p role="status" className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300">{importMode === 'test' ? 'Test responses are included in Analytics. Use Remove test file beside each uploaded file when finished.' : 'Each original file was archived. Re-uploads update matching responses using each row’s source ID.'}</p>}
        <p className="text-[11px] text-slate-500">Test import uses separate response IDs to preserve existing evaluations. Clear Analytics filters or choose the uploaded submission dates to see its results.</p>
        <p className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-[11px] text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300">
          Company names are matched against the full Partner Registry, including companies with another classification or an archived status. Normal imports use each response row's source ID; test imports use isolated IDs.
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-labelledby="evaluation-import-archive-title">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2"><LockKeyhole size={16} className="text-[#0063a9] dark:text-blue-400" aria-hidden="true" /><h3 id="evaluation-import-archive-title" className="text-sm font-bold text-slate-800 dark:text-slate-100">Stored Source Files</h3></div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Only Admins can view or download these files. Removing a file also removes responses still linked to that import from Analytics. Test removal clears its temporary partners too.</p>
        </div>
        {archiveLoadError && <p role="alert" className="px-5 py-3 text-xs text-rose-600 dark:text-rose-400">{archiveLoadError}</p>}
        {archiveActionError && <p role="alert" className="px-5 py-3 text-xs text-rose-600 dark:text-rose-400">{archiveActionError}</p>}
        {archiveActionSuccess && <p role="status" className="px-5 py-3 text-xs text-emerald-700 dark:text-emerald-400">{archiveActionSuccess}</p>}
        {isLoadingArchives ? (
          <div className="flex items-center gap-2 px-5 py-5 text-xs text-slate-500" role="status"><Loader2 size={14} className="animate-spin" aria-hidden="true" />Loading stored files…</div>
        ) : archives.length === 0 ? (
          <p className="px-5 py-5 text-xs text-slate-500 dark:text-slate-400">No source files have been archived yet.</p>
        ) : (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {archives.map((archive) => (
              <li key={archive.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3"><FileSpreadsheet size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" /><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100" title={archive.sourceFileName}>{archive.sourceFileName}</p><p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{isTestImportArchive(archive) ? 'Test import' : archive.surveyType === 'Combined' ? 'All evaluation categories' : archive.surveyType} · {formatFileSize(archive.fileSize)} · {new Date(archive.uploadedAt).toLocaleString()} · {archive.uploadedBy}</p></div></div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void handleDownloadArchive(archive)} disabled={downloadingArchiveId !== null || removingArchiveId !== null} className="secondary-button min-h-9 gap-1.5 px-3 text-xs disabled:opacity-60">
                    {downloadingArchiveId === archive.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Download size={13} aria-hidden="true" />}Download file
                  </button>
                  {isTestImportArchive(archive) && <button type="button" onClick={() => void handleRemoveTestImport(archive)} disabled={removingArchiveId !== null || downloadingArchiveId !== null} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900 dark:text-rose-400">
                    {removingArchiveId === archive.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <X size={13} aria-hidden="true" />}Remove test file
                  </button>}
                  {!isTestImportArchive(archive) && <button type="button" onClick={() => void handleRemoveOrdinaryImport(archive)} disabled={removingArchiveId !== null || downloadingArchiveId !== null} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900 dark:text-rose-400">
                    {removingArchiveId === archive.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <X size={13} aria-hidden="true" />}Remove file
                  </button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isReviewingCompanies && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="company-match-review-title" className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <button type="button" onClick={() => setIsReviewingCompanies(false)} className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-white" title="Close review"><X size={18} /></button>
            <div className="flex items-center gap-3 text-amber-600"><span className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950/30"><AlertTriangle size={20} /></span><div><h3 id="company-match-review-title" className="text-lg font-bold text-slate-900 dark:text-white">Review unmatched companies</h3><p className="text-xs text-slate-500">These names appear in the selected files but were not found in the Partner Registry.</p></div></div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" onClick={() => setDecisions((current) => ({ ...current, ...Object.fromEntries(SURVEY_TYPES.map((surveyType) => [surveyType, Object.fromEntries(Object.keys(current[surveyType]).map((name) => [name, 'add-as-partner' as CompanyDecision]))])) }))} className="text-[11px] font-bold text-[#0063a9] hover:underline dark:text-blue-400">Add all as partners</button>
              <button type="button" onClick={() => setDecisions((current) => ({ ...current, ...Object.fromEntries(SURVEY_TYPES.map((surveyType) => [surveyType, Object.fromEntries(Object.keys(current[surveyType]).map((name) => [name, 'skip' as CompanyDecision]))])) }))} className="text-[11px] font-bold text-slate-500 hover:underline">Skip all</button>
            </div>
            <ul className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
              {unmatchedCompanies.map(({ surveyType, match }) => (
                <li key={`${surveyType}-${match.normalizedName}`} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{match.rawName}</p><p className="text-[10px] text-slate-500">{surveyType} evaluation</p></div>
                  <select aria-label={`How to handle ${match.rawName}`} value={decisions[surveyType][match.normalizedName] ?? 'add-as-partner'} onChange={(event) => patchDecision(surveyType, match.normalizedName, event.target.value as CompanyDecision)} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <option value="add-as-partner">Add as a new partner</option><option value="skip">Skip this company's responses</option>
                  </select>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button type="button" onClick={() => setIsReviewingCompanies(false)} className="secondary-button min-h-10 px-4 text-xs">Cancel</button>
              <button type="button" onClick={() => void runBatchImport(importMode)} disabled={isImporting} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0063a9] px-4 text-xs font-bold text-white hover:bg-[#00528c] disabled:opacity-60">
                {isImporting && <Loader2 size={14} className="animate-spin" />}{importMode === 'test' ? 'Confirm test import' : 'Confirm and import files'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
