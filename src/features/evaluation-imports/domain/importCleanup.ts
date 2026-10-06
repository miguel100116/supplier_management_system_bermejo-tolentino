import type { SurveyResponse } from '../../../types/survey';
import type { EvaluationImportArchive } from './importArchive';
import { isTestImportArchive } from './testImport';

const NORMAL_BATCH_PATTERN = /^client-(?:workbook:[0-9a-f]{64}|csv:(?:supplier|subcontractor|courier):[0-9a-f]{64})$/i;

/** Normal imports can replace earlier rows. Delete only rows still tagged to this source. */
export function selectOrdinaryImportResponses(
  archive: EvaluationImportArchive,
  responses: readonly SurveyResponse[],
): SurveyResponse[] {
  if (isTestImportArchive(archive)) {
    throw new Error('Use test import removal so its responses and temporary partners are also deleted.');
  }
  if (!NORMAL_BATCH_PATTERN.test(archive.importBatchId)) {
    throw new Error('This source file has no recognized import identity. No responses were removed.');
  }
  const selected = responses.filter((response) => response.importBatchId === archive.importBatchId);
  if (selected.some((response) => {
    const category = typeof response.surveyType === 'string' ? response.surveyType.toUpperCase() : '';
    return response.dataSource !== 'client_csv'
      || !['SUPPLIER', 'SUBCONTRACTOR', 'COURIER'].includes(category)
      || !response.responseId.startsWith(`IMPORT-${category}-`)
      || (archive.surveyType !== 'Combined' && response.surveyType !== archive.surveyType);
  })) {
    throw new Error('The source batch contains responses with unexpected identities. No data was removed.');
  }
  return selected;
}
