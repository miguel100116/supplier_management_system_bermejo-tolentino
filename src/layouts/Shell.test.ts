import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { scrollModuleToTop } from './Shell';

test('module navigation resets the shared page scroll position', () => {
  let receivedOptions: ScrollToOptions | undefined;

  scrollModuleToTop({
    scrollTo(options) {
      receivedOptions = options;
    },
  });

  assert.deepEqual(receivedOptions, { top: 0, left: 0, behavior: 'auto' });
});

test('global header keeps the logo and renders no title text or separator', () => {
  const source = readFileSync(new URL('./Shell.tsx', import.meta.url), 'utf8');
  const headerSource = source.match(/<header\b[\s\S]*?<\/header>/)?.[0];

  assert.ok(headerSource?.includes('src="/microgenesis_logo.png"'));
  assert.ok(!headerSource?.includes('Supplier Management System'));
  assert.doesNotMatch(headerSource ?? '', /\{title\}/);
  assert.doesNotMatch(headerSource ?? '', />\s*\/\s*</);
});
