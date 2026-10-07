import assert from 'node:assert/strict';
import test from 'node:test';
import { createCoalescedTaskRunner } from './coalescedTask';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test('coalesces same-key bursts into one follow-up run', async () => {
  const firstRun = deferred();
  const calls: string[] = [];
  const run = createCoalescedTaskRunner(async (key: string) => {
    calls.push(key);
    if (calls.length === 1) await firstRun.promise;
  });

  const initial = run('responses');
  await Promise.resolve();
  const duplicateOne = run('responses');
  const duplicateTwo = run('responses');
  assert.deepEqual(calls, ['responses']);

  firstRun.resolve();
  await Promise.all([initial, duplicateOne, duplicateTwo]);
  assert.deepEqual(calls, ['responses', 'responses']);
});

test('runs different keys independently', async () => {
  const calls: string[] = [];
  const run = createCoalescedTaskRunner(async (key: string) => { calls.push(key); });

  await Promise.all([run('survey'), run('response')]);
  assert.deepEqual(calls.sort(), ['response', 'survey']);
});

test('clears a failed task so a later call can retry', async () => {
  let attempts = 0;
  const run = createCoalescedTaskRunner(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('temporary failure');
  });

  await assert.rejects(run('responses'), /temporary failure/);
  await run('responses');
  assert.equal(attempts, 2);
});

test('does not replay pending work after cancellation', async () => {
  const firstRun = deferred();
  let cancelled = false;
  let attempts = 0;
  const run = createCoalescedTaskRunner(async () => {
    attempts += 1;
    if (attempts === 1) await firstRun.promise;
  }, () => cancelled);

  const initial = run('responses');
  await Promise.resolve();
  const pending = run('responses');
  cancelled = true;
  firstRun.resolve();
  await Promise.all([initial, pending]);
  assert.equal(attempts, 1);
});
