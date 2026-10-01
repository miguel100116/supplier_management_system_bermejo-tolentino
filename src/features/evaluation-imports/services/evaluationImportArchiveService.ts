import { loadApplicationRecords, upsertApplicationRecords } from '../../../services/applicationRepository';
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
