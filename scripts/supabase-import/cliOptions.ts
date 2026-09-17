import { resolve } from 'node:path';

export interface CliOptions {
  projectRoot: string;
  aliasesPath?: string;
  write: boolean;
  confirmWrite: boolean;
}

function optionValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a path value.`);
  return value;
}

export function parseArgs(args: string[], cwd = process.cwd()): CliOptions {
  const options: CliOptions = {
    projectRoot: cwd,
    write: false,
    confirmWrite: false,
  };
  let dryRunRequested = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') dryRunRequested = true;
    else if (arg === '--write') options.write = true;
    else if (arg === '--confirm-write') options.confirmWrite = true;
    else if (arg === '--project-root') {
      options.projectRoot = resolve(cwd, optionValue(args, index, arg));
      index += 1;
    } else if (arg === '--aliases') {
      options.aliasesPath = resolve(cwd, optionValue(args, index, arg));
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }

  if (dryRunRequested && options.write) {
    throw new Error('--dry-run and --write are mutually exclusive.');
  }
  if (options.write && !options.confirmWrite) {
    throw new Error('Live writes require both --write and --confirm-write. Run without them for the default dry-run.');
  }
  if (options.confirmWrite && !options.write) {
    throw new Error('--confirm-write is only valid together with --write.');
  }
  return options;
}
