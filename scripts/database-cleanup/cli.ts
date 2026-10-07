import { buildTestEvaluationCleanupSql, parseCleanupMode } from './testEvaluationsSql';

try {
  process.stdout.write(buildTestEvaluationCleanupSql(parseCleanupMode(process.argv.slice(2))));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Unable to generate cleanup SQL.'}\n`);
  process.exitCode = 1;
}
