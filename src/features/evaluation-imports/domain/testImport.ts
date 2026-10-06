import type { PartnerCompany, SurveyResponse, SurveyType } from '../../../types/survey';
import type { EvaluationImportArchive } from './importArchive';

const TEST_BATCH_PATTERN = /^test-workbook:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function createTestImportBatchId(): string {
  return `test-workbook:${crypto.randomUUID()}`;
}

export function testImportToken(importBatchId: string): string | null {
  return TEST_BATCH_PATTERN.exec(importBatchId)?.[1].toLowerCase() ?? null;
}

export function testImportResponseId(importBatchId: string, surveyType: SurveyType, rowIndex: number): string {
  const token = testImportToken(importBatchId);
  if (!token) throw new Error('Invalid test import batch ID.');
  return `TESTIMPORT-${token}-${surveyType.toUpperCase()}-${rowIndex}`;
}

export function testImportCompanyId(importBatchId: string, surveyType: SurveyType, companyIndex: number): string {
  const token = testImportToken(importBatchId);
  if (!token) throw new Error('Invalid test import batch ID.');
  return `pc-test-${token}-${surveyType.toLowerCase()}-${companyIndex}`;
}

export function isTestImportArchive(archive: EvaluationImportArchive): boolean {
  return testImportToken(archive.importBatchId) !== null;
}

export function selectTestImportCleanup(
  archive: EvaluationImportArchive,
  responses: SurveyResponse[],
  companies: PartnerCompany[],
): { responses: SurveyResponse[]; companies: PartnerCompany[] } {
  if (!isTestImportArchive(archive)) throw new Error('Only isolated test imports can be removed.');
  const token = testImportToken(archive.importBatchId)!;
  const selectedResponses = responses.filter((response) => response.importBatchId === archive.importBatchId);
  const selectedCompanies = companies.filter((company) => company.testImportBatchId === archive.importBatchId);

  if (selectedResponses.some((response) =>
    response.dataSource !== 'client_csv' || !response.responseId.startsWith(`TESTIMPORT-${token}-`))) {
    throw new Error('The test batch contains responses with unexpected identities. No data was removed.');
  }
  if (selectedCompanies.some((company) => !company.id.startsWith(`pc-test-${token}-`))) {
    throw new Error('The test batch contains partner records with unexpected identities. No data was removed.');
  }
  const companyIds = new Set(selectedCompanies.map((company) => company.id));
  if (responses.some((response) => response.importBatchId !== archive.importBatchId && response.companyId && companyIds.has(response.companyId))) {
    throw new Error('A test partner is referenced by another evaluation. Remove that dependency before deleting this test import.');
  }
  return { responses: selectedResponses, companies: selectedCompanies };
}
