import { IMPORT_TABLE_ROWS, type ImportPlan } from './importPlan';

function sqlIdentifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
}

function sqlLiteral(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite numbers cannot be written to SQL.');
    return String(value);
  }
  if (typeof value === 'string') {
    if (value.includes('\0')) throw new Error('NUL characters cannot be written to PostgreSQL text values.');
    return `'${value.replaceAll("'", "''")}'`;
  }
  throw new Error(`Unsupported SQL value type: ${typeof value}`);
}

export function buildImportSql(plan: ImportPlan, chunkSize = 250): string {
  if (plan.summary.blockingErrors > 0) {
    throw new Error(`SQL generation refused: dry-run found ${plan.summary.blockingErrors} blocking error(s).`);
  }
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) throw new Error('SQL chunk size must be a positive integer.');

  const statements = [
    '-- Generated staging import. Contains confidential business data; do not commit.',
    'begin;',
    "set local statement_timeout = '0';",
  ];

  for (const [table, planKey, onConflict] of IMPORT_TABLE_ROWS) {
    const rows = plan[planKey];
    if (!Array.isArray(rows)) throw new Error(`Internal importer error: ${String(planKey)} is not a row array.`);
    if (rows.length === 0) continue;
    const columns = Object.keys(rows[0]);
    const signature = columns.join('\0');
    if (!columns.includes(onConflict)) throw new Error(`${table} rows do not contain conflict key ${onConflict}.`);
    for (const row of rows) {
      if (Object.keys(row).join('\0') !== signature) throw new Error(`${table} rows do not share one column shape.`);
    }

    const quotedTable = `public.${sqlIdentifier(table)}`;
    const quotedColumns = columns.map(sqlIdentifier).join(', ');
    const updateColumns = columns.filter((column) => column !== onConflict);
    const conflictAction = updateColumns.length === 0
      ? 'do nothing'
      : `do update set ${updateColumns.map((column) => `${sqlIdentifier(column)} = excluded.${sqlIdentifier(column)}`).join(', ')}`;

    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      const chunk = rows.slice(offset, offset + chunkSize);
      const values = chunk
        .map((row) => `(${columns.map((column) => sqlLiteral(row[column])).join(', ')})`)
        .join(',\n');
      statements.push(
        `insert into ${quotedTable} (${quotedColumns}) values\n${values}\non conflict (${sqlIdentifier(onConflict)}) ${conflictAction};`,
      );
    }
  }

  statements.push('commit;');
  return `${statements.join('\n\n')}\n`;
}
