import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { parseArgs } from './cliOptions';

const cwd = resolve('C:\\local-import-test');

test('defaults to dry-run behavior without accepting ambiguous write flags', () => {
  assert.deepEqual(parseArgs([], cwd), {
    projectRoot: cwd,
    write: false,
    confirmWrite: false,
  });
  assert.deepEqual(parseArgs(['--dry-run'], cwd), {
    projectRoot: cwd,
    write: false,
    confirmWrite: false,
  });
  assert.throws(() => parseArgs(['--dry-run', '--write', '--confirm-write'], cwd), /mutually exclusive/);
  assert.throws(() => parseArgs(['--write'], cwd), /both --write and --confirm-write/);
  assert.throws(() => parseArgs(['--confirm-write'], cwd), /only valid together/);
});

test('requires explicit values for path options', () => {
  assert.throws(() => parseArgs(['--aliases'], cwd), /--aliases requires a path value/);
  assert.throws(() => parseArgs(['--project-root', '--dry-run'], cwd), /--project-root requires a path value/);
  assert.throws(() => parseArgs(['--unknown'], cwd), /Unknown argument/);
});

test('resolves project and alias paths from the invocation directory', () => {
  const options = parseArgs([
    '--project-root', 'sources',
    '--aliases', 'private/aliases.json',
    '--write',
    '--confirm-write',
  ], cwd);

  assert.deepEqual(options, {
    projectRoot: resolve(cwd, 'sources'),
    aliasesPath: resolve(cwd, 'private/aliases.json'),
    write: true,
    confirmWrite: true,
  });
});
