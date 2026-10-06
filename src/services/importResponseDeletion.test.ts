import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { deleteImportedSurveyResponses } from './applicationRepository';

const oldBatch = `client-workbook:${'a'.repeat(64)}`;
const newBatch = `client-workbook:${'b'.repeat(64)}`;
interface StoredRow {
  record_id: string;
  record_type: string;
  payload: { importBatchId: string; dataSource: string };
}
function row(id: string, batch = oldBatch, source = 'client_csv', type = 'survey_response'): StoredRow {
  return { record_id: id, record_type: type, payload: { importBatchId: batch, dataSource: source } };
}

function provider(rows: StoredRow[], options: {
  beforeDelete?: () => void; failRequest?: number; malformed?: boolean;
} = {}) {
  const requests: URL[] = [];
  const client = createClient('https://synthetic.supabase.co', 'synthetic-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(init?.method, 'DELETE');
      assert.equal(url.pathname, '/rest/v1/application_records');
      requests.push(url);
      options.beforeDelete?.();
      if (options.failRequest === requests.length) {
        return new Response(JSON.stringify({ message: 'Deletion rejected' }), { status: 403 });
      }
      const ids = url.searchParams.get('record_id')!.slice(4, -1).split(',');
      const removed = rows.filter((item) => ids.includes(item.record_id)
        && `eq.${item.record_type}` === url.searchParams.get('record_type')
        && `eq.${item.payload.importBatchId}` === url.searchParams.get('payload->>importBatchId')
        && `eq.${item.payload.dataSource}` === url.searchParams.get('payload->>dataSource'));
      for (const item of removed) rows.splice(rows.indexOf(item), 1);
      return new Response(JSON.stringify(options.malformed ? {} : removed.map(({ record_id }) => ({ record_id }))), {
        headers: { 'Content-Type': 'application/json' },
      });
    } },
  });
  return { client, requests };
}

test('deletion preserves a response replaced by a concurrent re-import', async () => {
  const rows = [row('IMPORT-SUPPLIER-1:q1'), row('IMPORT-SUPPLIER-2:q1')];
  const selectedIds = rows.map((item) => item.record_id);
  const { client } = provider(rows, { beforeDelete: () => { rows[0].payload.importBatchId = newBatch; } });
  const deleted = await deleteImportedSurveyResponses(client, selectedIds, oldBatch);
  assert.deepEqual(deleted, ['IMPORT-SUPPLIER-2:q1']);
  assert.deepEqual(rows, [row('IMPORT-SUPPLIER-1:q1', newBatch)]);
});

test('deletion protects other batches, production responses, other collections and unselected rows', async () => {
  const rows = [row('selected'), row('newer', newBatch), row('official', oldBatch, 'production_submission'),
    row('company', oldBatch, 'client_csv', 'partner_company'), row('unselected')];
  const { client } = provider(rows);
  assert.deepEqual(await deleteImportedSurveyResponses(client, ['selected', 'newer', 'official', 'company'], oldBatch), ['selected']);
  assert.deepEqual(rows.map((item) => item.record_id), ['newer', 'official', 'company', 'unselected']);
});

test('large deletions use bounded requests and preserve batch predicates in every chunk', async () => {
  const rows = Array.from({ length: 601 }, (_, index) => row(`response-${index}`));
  const ids = rows.map((item) => item.record_id);
  const { client, requests } = provider(rows);
  assert.deepEqual(await deleteImportedSurveyResponses(client, ids, oldBatch), ids);
  assert.equal(rows.length, 0);
  assert.equal(requests.length, 3);
  for (const url of requests) {
    assert.equal(url.searchParams.get('payload->>importBatchId'), `eq.${oldBatch}`);
    assert.equal(url.searchParams.get('select'), 'record_id');
  }
});

test('provider failures and malformed deletion results cannot report success', async () => {
  const rows = Array.from({ length: 301 }, (_, index) => row(`response-${index}`));
  const ids = rows.map((item) => item.record_id);
  const failed = provider(rows, { failRequest: 2 });
  await assert.rejects(deleteImportedSurveyResponses(failed.client, ids, oldBatch), /Deletion rejected/);
  assert.deepEqual(rows.map((item) => item.record_id), ['response-300']);
  const malformed = provider([row('selected')], { malformed: true });
  await assert.rejects(deleteImportedSurveyResponses(malformed.client, ['selected'], oldBatch), /Unable to confirm/);
});

test('empty selections make no requests and missing batch identity fails before deletion', async () => {
  const { client, requests } = provider([]);
  assert.deepEqual(await deleteImportedSurveyResponses(client, [], oldBatch), []);
  await assert.rejects(deleteImportedSurveyResponses(client, ['selected'], ' '), /batch ID is required/);
  assert.equal(requests.length, 0);
});
