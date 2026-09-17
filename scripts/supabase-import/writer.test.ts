import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ImportPlan } from './importPlan';
import { upsertImportPlan, type ImportClient } from './writer';

function planWithOneRowPerTable(blockingErrors = 0): ImportPlan {
  return {
    sourceFiles: [{ id: 'source' }],
    companies: [{ id: 'company' }],
    companyBranches: [{ id: 'branch' }],
    companyDocuments: [{ id: 'document' }],
    evaluationForms: [{ code: 'Supplier' }],
    evaluationQuestions: [{ id: 'question' }],
    evaluators: [{ id: 'evaluator' }],
    companyAliases: [{ id: 'alias' }],
    evaluationSubmissions: [{ id: 'submission' }],
    evaluationAnswers: [{ id: 'answer' }],
    issues: [],
    summary: {
      masterNamedRows: 0,
      masterUniqueRecords: 0,
      masterExactDuplicatesSkipped: 0,
      masterBlankBpCodes: 0,
      evaluationSubmissions: { Courier: 0, Supplier: 0, Subcontractor: 0 },
      answerStatuses: { rated: 0, not_applicable: 0, populated: 0, missing: 0 },
      unresolvedCompanyNames: 0,
      blockingErrors,
    },
  };
}

test('upserts every plan table in dependency order with its configured conflict key', async () => {
  const calls: Array<{ table: string; rows: Record<string, unknown>[]; onConflict: string }> = [];
  const client: ImportClient = {
    from: (table) => ({
      upsert: async (rows, options) => {
        calls.push({ table, rows, onConflict: options.onConflict });
        return { error: null };
      },
    }),
  };

  await upsertImportPlan(client, planWithOneRowPerTable());

  assert.deepEqual(calls.map(({ table, onConflict }) => [table, onConflict]), [
    ['import_source_files', 'id'],
    ['companies', 'id'],
    ['company_branches', 'id'],
    ['company_documents', 'id'],
    ['evaluation_forms', 'code'],
    ['evaluation_questions', 'id'],
    ['evaluators', 'id'],
    ['company_aliases', 'id'],
    ['evaluation_submissions', 'id'],
    ['evaluation_answers', 'id'],
  ]);
  assert.ok(calls.every((call) => call.rows.length === 1));
});

test('refuses all client calls when the plan has blocking errors', async () => {
  let calls = 0;
  const client: ImportClient = {
    from: () => ({
      upsert: async () => {
        calls += 1;
        return { error: null };
      },
    }),
  };

  await assert.rejects(
    upsertImportPlan(client, planWithOneRowPerTable(2)),
    /Write refused: dry-run found 2 blocking error\(s\)/,
  );
  assert.equal(calls, 0);
});

test('reports the table and row range when an upsert fails', async () => {
  const client: ImportClient = {
    from: (table) => ({
      upsert: async () => ({
        error: table === 'companies' ? { message: 'simulated failure' } : null,
      }),
    }),
  };

  await assert.rejects(
    upsertImportPlan(client, planWithOneRowPerTable()),
    /companies rows 1-1: simulated failure/,
  );
});
