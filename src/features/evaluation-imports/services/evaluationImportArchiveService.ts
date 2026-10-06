import {
  APPLICATION_RECORD_CHANGED_EVENT,
  deleteApplicationRecords,
  deleteImportedSurveyResponses,
  loadApplicationRecords,
  surveyResponseRecordId,
  upsertApplicationRecords,
} from '../../../services/applicationRepository';
import { isSupabaseConfigured, supabase } from '../../../services/supabaseClient';
import {
  EVALUATION_IMPORT_ARCHIVE_BUCKET,
  EvaluationImportArchive,
  evaluationImportContentType,
  evaluationImportFileExtension,
  MAX_EVALUATION_IMPORT_FILE_BYTES,
  parseEvaluationImportArchive,
} from '../domain/importArchive';
import type { SurveyType } from '../../../types/survey';
import type { PartnerCompany, SurveyResponse } from '../../../types/survey';
import { isTestImportArchive, selectTestImportCleanup } from '../domain/testImport';
import { selectOrdinaryImportResponses } from '../domain/importCleanup';

function archiveSetupError(error: unknown): Error {
  const message = error instanceof Error ? error.message : 'Unknown Supabase error.';
  if (/bucket not found|evaluation-import-archives/i.test(message) && /bucket not found|not found/i.test(message)) {
    return new Error('Evaluation source-file storage is not enabled in this Supabase project yet. Apply migration 202609300001_evaluation_import_archives.sql, then retry.');
  }
  if (message.includes('application_records_record_type_check')) {
    return new Error('Evaluation source-file archives are not enabled in this Supabase project yet. Apply migration 202609300001_evaluation_import_archives.sql, then retry.');
  }
  return error instanceof Error ? error : new Error(message);
}

export async function loadEvaluationImportArchives(): Promise<EvaluationImportArchive[]> {
  const records = await loadApplicationRecords<unknown>('evaluation_import_archive');
  return records
    .map(parseEvaluationImportArchive)
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
}

export async function saveEvaluationImportArchive(
  file: File,
  surveyType: SurveyType | 'Combined',
  uploadedBy: string,
  importBatchId: string,
): Promise<EvaluationImportArchive> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured. The source file was not imported.');
  if (file.size <= 0 || file.size > MAX_EVALUATION_IMPORT_FILE_BYTES) {
    throw new Error('The source file must be between 1 byte and 25 MB.');
  }
  const extension = evaluationImportFileExtension(file.name);
  const id = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();
  const storagePath = `${surveyType.toLocaleLowerCase()}/${uploadedAt.slice(0, 10)}/${id}${extension}`;
  const contentType = evaluationImportContentType(file.name);

  const { error: uploadError } = await supabase.storage
    .from(EVALUATION_IMPORT_ARCHIVE_BUCKET)
    .upload(storagePath, file, { contentType, cacheControl: '3600', upsert: false });
  if (uploadError) {
    throw archiveSetupError(new Error(`Unable to store the source file in Supabase Storage: ${uploadError.message}`));
  }

  const archive = parseEvaluationImportArchive({
    id,
    surveyType,
    uploadedAt,
    uploadedBy: uploadedBy.trim().toLocaleLowerCase(),
    sourceFileName: file.name,
    storagePath,
    contentType,
    fileSize: file.size,
    importBatchId,
  });

  try {
    await upsertApplicationRecords('evaluation_import_archive', [archive], (record) => record.id);
  } catch (error) {
    const { error: rollbackError } = await supabase.storage
      .from(EVALUATION_IMPORT_ARCHIVE_BUCKET)
      .remove([storagePath]);
    if (rollbackError) {
      throw new Error(`Archive metadata could not be saved, and the uploaded object could not be removed: ${rollbackError.message}`);
    }
    throw archiveSetupError(error);
  }

  return archive;
}

export async function downloadEvaluationImportArchive(archive: EvaluationImportArchive): Promise<Blob> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.storage
    .from(EVALUATION_IMPORT_ARCHIVE_BUCKET)
    .download(archive.storagePath);
  if (error) throw new Error(`Unable to download the archived source file: ${error.message}`);
  return data;
}

export async function discardPendingEvaluationImportArchive(archive: EvaluationImportArchive): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const stored = (await loadEvaluationImportArchives()).find((item) => item.id === archive.id);
  if (!stored || stored.importBatchId !== archive.importBatchId || stored.storagePath !== archive.storagePath) {
    throw new Error('The staged source file changed before it could be removed.');
  }
  const { error } = await supabase.storage.from(EVALUATION_IMPORT_ARCHIVE_BUCKET).remove([stored.storagePath]);
  if (error) throw new Error(`Unable to remove staged source file: ${error.message}`);
  await deleteApplicationRecords('evaluation_import_archive', [stored.id]);
}

export async function removeOrdinaryEvaluationImport(archive: EvaluationImportArchive): Promise<{ responsesRemoved: number }> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const storedArchive = (await loadEvaluationImportArchives()).find((item) => item.id === archive.id);
  if (!storedArchive || storedArchive.importBatchId !== archive.importBatchId || storedArchive.storagePath !== archive.storagePath) {
    throw new Error('This source file archive has changed. Refresh the page before removing it.');
  }
  const responses = await loadApplicationRecords<SurveyResponse>('survey_response');
  const selected = selectOrdinaryImportResponses(storedArchive, responses);
  let deletedIds: string[] = [];
  try {
    deletedIds = await deleteImportedSurveyResponses(supabase, selected.map(surveyResponseRecordId), storedArchive.importBatchId);
    const remaining = await loadApplicationRecords<SurveyResponse>('survey_response');
    if (remaining.some((response) => response.importBatchId === storedArchive.importBatchId)) {
      throw new Error('Some imported responses could not be removed. The stored source file was kept.');
    }
    const { error } = await supabase.storage.from(EVALUATION_IMPORT_ARCHIVE_BUCKET).remove([storedArchive.storagePath]);
    if (error) throw new Error(`The imported responses were removed, but the source file could not be deleted: ${error.message}`);
    await deleteApplicationRecords('evaluation_import_archive', [storedArchive.id]);
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(APPLICATION_RECORD_CHANGED_EVENT, { detail: { recordType: 'survey_response' } }));
    }
  }
  const deletedRecordIds = new Set(deletedIds);
  return { responsesRemoved: new Set(selected
    .filter((response) => deletedRecordIds.has(surveyResponseRecordId(response)))
    .map((response) => response.responseId)).size };
}

export async function removeTestEvaluationImport(archive: EvaluationImportArchive): Promise<{ responsesRemoved: number; companiesRemoved: number }> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  if (!isTestImportArchive(archive)) throw new Error('Only isolated test imports can be removed.');

  const storedArchive = (await loadEvaluationImportArchives()).find((item) => item.id === archive.id);
  if (!storedArchive || storedArchive.importBatchId !== archive.importBatchId || storedArchive.storagePath !== archive.storagePath) {
    throw new Error('This test import archive has changed. Refresh the page before removing it.');
  }

  const [responses, companies] = await Promise.all([
    loadApplicationRecords<SurveyResponse>('survey_response'),
    loadApplicationRecords<PartnerCompany>('partner_company'),
  ]);
  const selected = selectTestImportCleanup(storedArchive, responses, companies);

  try {
    await deleteApplicationRecords('survey_response', selected.responses.map(surveyResponseRecordId));
    await deleteApplicationRecords('partner_company', selected.companies.map((company) => company.id));
    const { error: storageError } = await supabase.storage
      .from(EVALUATION_IMPORT_ARCHIVE_BUCKET)
      .remove([storedArchive.storagePath]);
    if (storageError) throw new Error(`The test responses were removed, but the source file could not be deleted: ${storageError.message}`);
    await deleteApplicationRecords('evaluation_import_archive', [storedArchive.id]);
  } finally {
    if (typeof window !== 'undefined') {
      for (const recordType of ['survey_response', 'partner_company'] as const) {
        window.dispatchEvent(new CustomEvent(APPLICATION_RECORD_CHANGED_EVENT, { detail: { recordType } }));
      }
    }
  }

  return { responsesRemoved: new Set(selected.responses.map((response) => response.responseId)).size, companiesRemoved: selected.companies.length };
}
