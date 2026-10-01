import type { SurveyType } from '../../../types/survey';

export const EVALUATION_IMPORT_ARCHIVE_RECORD_TYPE = 'evaluation_import_archive' as const;
export const EVALUATION_IMPORT_ARCHIVE_BUCKET = 'evaluation-import-archives';
export const MAX_EVALUATION_IMPORT_FILE_BYTES = 25 * 1024 * 1024;

export interface EvaluationImportArchive {
  id: string;
  surveyType: SurveyType | 'Combined';
  uploadedAt: string;
  uploadedBy: string;
  sourceFileName: string;
  storagePath: string;
  contentType: string;
  fileSize: number;
  importBatchId: string;
}

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.csv': 'text/csv',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function evaluationImportFileExtension(fileName: string): string {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLocaleLowerCase();
  if (!Object.hasOwn(MIME_TYPE_BY_EXTENSION, extension)) {
    throw new Error('Choose a Microsoft Forms export file (.csv, .xls, or .xlsx).');
  }
  return extension;
}

export function evaluationImportContentType(fileName: string): string {
  return MIME_TYPE_BY_EXTENSION[evaluationImportFileExtension(fileName)];
}

export function parseEvaluationImportArchive(value: unknown): EvaluationImportArchive {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('An evaluation import archive is not an object.');
  }

  const candidate = value as Partial<EvaluationImportArchive>;
  const validSurveyType = candidate.surveyType === 'Combined'
    || candidate.surveyType === 'Courier'
    || candidate.surveyType === 'Supplier'
    || candidate.surveyType === 'Subcontractor';
  const validTimestamp = typeof candidate.uploadedAt === 'string' && !Number.isNaN(Date.parse(candidate.uploadedAt));
  const validFileSize = typeof candidate.fileSize === 'number'
    && Number.isInteger(candidate.fileSize)
    && candidate.fileSize > 0
    && candidate.fileSize <= MAX_EVALUATION_IMPORT_FILE_BYTES;

  if (
    typeof candidate.id !== 'string'
    || candidate.id.length === 0
    || candidate.id.length > 500
    || !validSurveyType
    || !validTimestamp
    || typeof candidate.uploadedBy !== 'string'
    || !candidate.uploadedBy.trim()
    || candidate.uploadedBy.length > 500
    || typeof candidate.sourceFileName !== 'string'
    || !candidate.sourceFileName.trim()
    || candidate.sourceFileName.length > 2_000
    || typeof candidate.storagePath !== 'string'
    || !candidate.storagePath.startsWith(`${candidate.surveyType?.toLocaleLowerCase()}/`)
    || candidate.storagePath.length > 2_000
    || typeof candidate.contentType !== 'string'
    || candidate.contentType !== MIME_TYPE_BY_EXTENSION[evaluationImportFileExtension(candidate.sourceFileName)]
    || !validFileSize
    || typeof candidate.importBatchId !== 'string'
    || !candidate.importBatchId.trim()
    || candidate.importBatchId.length > 2_000
  ) {
    throw new Error('An evaluation import archive has an invalid stored shape.');
  }

  return candidate as EvaluationImportArchive;
}
