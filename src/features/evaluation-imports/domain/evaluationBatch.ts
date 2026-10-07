import type { PartnerCompany } from '../../../types/survey';
import { normalizeCompanyName } from '../../../utils/masterListImport';
import type { RawEvalCommitResult, RawEvalPreview } from '../../../utils/rawEvaluationImport';
import type { EvaluationImportArchive } from './importArchive';
import { testImportToken } from './testImport';

export type PreparedEvaluationBatchEntry = { preview: RawEvalPreview } & RawEvalCommitResult;

/** Source IDs are stable only within a category. Never let one file silently replace another in a batch. */
export function validateEvaluationBatchPreviews(previews: readonly RawEvalPreview[]): void {
  const seen = new Map<string, string>();
  for (const preview of previews) {
    for (const row of preview.rows) {
      const key = row.responseId;
      const previousFile = seen.get(key);
      if (previousFile) {
        throw new Error(`${preview.surveyType} response ID ${key} appears more than once in this batch (${previousFile} and ${preview.fileName}). Choose files with non-overlapping response IDs.`);
      }
      seen.set(key, preview.fileName);
    }
  }
}

/** A new registry partner appearing in several files is created once for normal imports. */
export function reconcileEvaluationBatchPartners(entries: readonly PreparedEvaluationBatchEntry[]): PreparedEvaluationBatchEntry[] {
  const companyByName = new Map<string, PartnerCompany>();
  return entries.map((entry) => {
    if (testImportToken(entry.preview.importBatchId)) return entry;
    const replacements = new Map<string, PartnerCompany>();
    const newPartnerCompanies = entry.newPartnerCompanies.filter((company) => {
      const normalized = normalizeCompanyName(company.name);
      const existing = companyByName.get(normalized);
      if (existing) {
        replacements.set(company.id, existing);
        return false;
      }
      companyByName.set(normalized, company);
      return true;
    });
    return {
      ...entry,
      newPartnerCompanies,
      responses: entry.responses.map((response) => {
        const canonical = response.companyId ? replacements.get(response.companyId) : undefined;
        return canonical ? { ...response, companyId: canonical.id, company: canonical.name } : response;
      }),
      summary: { ...entry.summary, addedCompanies: newPartnerCompanies.map((company) => company.name) },
    };
  });
}

/** Source files are archived before any response write; undo staged archives if that phase fails. */
export async function archiveEvaluationBatch<T>(
  items: readonly T[],
  archive: (item: T) => Promise<EvaluationImportArchive>,
  discard: (archive: EvaluationImportArchive) => Promise<void>,
): Promise<EvaluationImportArchive[]> {
  const staged: EvaluationImportArchive[] = [];
  try {
    for (const item of items) staged.push(await archive(item));
    return staged;
  } catch (error) {
    const failedCleanup: string[] = [];
    for (const stored of [...staged].reverse()) {
      try {
        await discard(stored);
      } catch {
        failedCleanup.push(stored.sourceFileName);
      }
    }
    if (failedCleanup.length) {
      const reason = error instanceof Error ? error.message : 'Unable to archive a source file.';
      throw new Error(`${reason} Earlier files could not be removed: ${failedCleanup.join(', ')}. No responses were imported.`);
    }
    throw error;
  }
}
