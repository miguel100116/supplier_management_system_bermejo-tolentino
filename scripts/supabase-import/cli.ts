import { createClient } from '@supabase/supabase-js';
import {
  buildImportPlan,
  loadCompanyAliases,
  type ImportPlan,
} from './importPlan';
import { upsertImportPlan, type ImportClient } from './writer';
import { parseArgs } from './cliOptions';

function publicReport(plan: ImportPlan) {
  return {
    mode: 'dry-run',
    sourceFiles: plan.sourceFiles.map((row) => ({
      fileName: row.file_name,
      sourceRecordCount: row.source_record_count,
      sha256: row.sha256,
    })),
    plannedRows: {
      companies: plan.companies.length,
      companyBranches: plan.companyBranches.length,
      companyDocuments: plan.companyDocuments.length,
      evaluationForms: plan.evaluationForms.length,
      evaluationQuestions: plan.evaluationQuestions.length,
      evaluators: plan.evaluators.length,
      companyAliases: plan.companyAliases.length,
      evaluationSubmissions: plan.evaluationSubmissions.length,
      evaluationAnswers: plan.evaluationAnswers.length,
    },
    summary: plan.summary,
    issues: plan.issues,
  };
}

async function writePlan(plan: ImportPlan) {
  if (plan.summary.blockingErrors > 0) {
    throw new Error(`Write refused: dry-run found ${plan.summary.blockingErrors} blocking error(s).`);
  }
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error('Write requires server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await upsertImportPlan(client as unknown as ImportClient, plan);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const aliases = options.aliasesPath ? loadCompanyAliases(options.aliasesPath) : [];
  const plan = buildImportPlan(options.projectRoot, aliases);
  process.stdout.write(`${JSON.stringify(publicReport(plan), null, 2)}\n`);
  if (!options.write) {
    if (plan.summary.blockingErrors > 0) process.exitCode = 2;
    return;
  }
  await writePlan(plan);
  process.stdout.write('Import completed with idempotent upserts.\n');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Supabase import failed: ${message}\n`);
  process.exitCode = 1;
});
