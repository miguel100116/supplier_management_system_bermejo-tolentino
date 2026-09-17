import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ImportPlan } from './importPlan';
import { buildImportSql } from './sqlImport';

function emptyPlan(): ImportPlan {
  return {
    sourceFiles: [], companies: [], companyBranches: [], companyDocuments: [],
    evaluationForms: [], evaluationQuestions: [], evaluators: [], companyAliases: [],
    evaluationSubmissions: [], evaluationAnswers: [], issues: [],
    summary: {
      masterNamedRows: 0,
      masterUniqueRecords: 0,
      masterExactDuplicatesSkipped: 0,
      masterBlankBpCodes: 0,
      evaluationSubmissions: { Courier: 0, Supplier: 0, Subcontractor: 0 },
      answerStatuses: { rated: 0, not_applicable: 0, populated: 0, missing: 0 },
      unresolvedCompanyNames: 0,
      blockingErrors: 0,
    },
  };
}

test('builds an atomic, escaped, idempotent SQL import', () => {
  const plan = emptyPlan();
  plan.companies = [{
    id: 'company-id',
    canonical_name: "O'Brien Supply",
    source_name_key: 'o-brien',
    normalized_name: 'O BRIEN SUPPLY',
  }];
  plan.evaluationForms = [{ code: 'Supplier', source_file_id: 'source-id', source_name: 'supplier.csv' }];

  const sql = buildImportSql(plan);

  assert.match(sql, /^-- Generated staging import/m);
  assert.match(sql, /begin;/);
  assert.match(sql, /'O''Brien Supply'/);
  assert.match(sql, /insert into public\."evaluation_forms"/);
  assert.match(sql, /on conflict \("code"\) do update/);
  assert.match(sql, /commit;\s*$/);
  assert.doesNotMatch(sql, /\b(delete|truncate|drop)\b/i);
});

test('refuses SQL generation when the dry run has blockers', () => {
  const plan = emptyPlan();
  plan.summary.blockingErrors = 1;
  assert.throws(() => buildImportSql(plan), /generation refused/);
});
