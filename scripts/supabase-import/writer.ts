import { IMPORT_TABLE_ROWS, type ImportPlan } from './importPlan';

export interface ImportClient {
  from(table: string): {
    upsert(
      rows: Record<string, unknown>[],
      options: { onConflict: string },
    ): PromiseLike<{ error: { message: string } | null }>;
  };
}

export async function upsertInChunks(
  client: ImportClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  chunkSize = 500,
) {
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const { error } = await client.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table} rows ${offset + 1}-${offset + chunk.length}: ${error.message}`);
  }
}

export async function upsertImportPlan(client: ImportClient, plan: ImportPlan) {
  if (plan.summary.blockingErrors > 0) {
    throw new Error(`Write refused: dry-run found ${plan.summary.blockingErrors} blocking error(s).`);
  }
  for (const [table, planKey, onConflict] of IMPORT_TABLE_ROWS) {
    const rows = plan[planKey];
    if (!Array.isArray(rows)) throw new Error(`Internal importer error: ${String(planKey)} is not a row array.`);
    await upsertInChunks(client, table, rows as Record<string, unknown>[], onConflict);
  }
}
