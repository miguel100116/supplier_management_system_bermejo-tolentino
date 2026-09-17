import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildImportPlan, loadCompanyAliases } from './importPlan';
import { buildImportSql } from './sqlImport';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const aliasesPath = resolve(projectRoot, 'scripts', 'supabase-import', 'company-aliases.json');
const outputPath = resolve(projectRoot, 'supabase', '.temp', 'normalized-staging-import.sql');
const plan = buildImportPlan(projectRoot, loadCompanyAliases(aliasesPath));
const sql = buildImportSql(plan);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, sql, { encoding: 'utf8', flag: 'w', mode: 0o600 });
process.stdout.write(`Generated staging SQL (${Buffer.byteLength(sql)} bytes): ${outputPath}\n`);
