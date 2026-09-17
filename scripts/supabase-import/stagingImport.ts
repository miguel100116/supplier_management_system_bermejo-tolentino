import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STAGING_URL = 'https://adxwaxhnqxpmgjvsxgug.supabase.co';
const configuredUrl = process.env.SUPABASE_URL?.trim();

if (configuredUrl && configuredUrl !== STAGING_URL) {
  throw new Error(`Staging import refused: SUPABASE_URL must be ${STAGING_URL}.`);
}

process.env.SUPABASE_URL = STAGING_URL;
const aliasesPath = resolve(dirname(fileURLToPath(import.meta.url)), 'company-aliases.json');
process.argv.push('--write', '--confirm-write', '--aliases', aliasesPath);

await import('./cli');
