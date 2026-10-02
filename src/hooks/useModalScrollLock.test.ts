import assert from 'node:assert/strict';
import test from 'node:test';
import { acquireModalScrollLock } from './useModalScrollLock';

function fakePage(scrollbarWidth: number) {
  const bodyStyle = {
    position: 'relative', top: '', left: '', right: '', width: '',
    overflow: 'auto', paddingRight: '4px',
  };
  const rootStyle = { overflow: 'auto' };
  const scrollCalls: Array<[number, number]> = [];
  const pageDocument = {
    body: { style: bodyStyle },
    documentElement: { style: rootStyle, clientWidth: 1200 - scrollbarWidth },
  } as unknown as Document;
  const browserWindow = {
    scrollX: 12,
    scrollY: 360,
    innerWidth: 1200,
    getComputedStyle: () => ({ paddingRight: '4px' }),
    scrollTo: (x: number, y: number) => { scrollCalls.push([x, y]); },
  } as unknown as Window;
  return { bodyStyle, rootStyle, scrollCalls, browserWindow, pageDocument };
}

test('SMS-66 locks background scroll across nested dialogs and restores its original position', () => {
  const page = fakePage(16);
  const releaseOuter = acquireModalScrollLock(page.browserWindow, page.pageDocument);
  assert.equal(page.bodyStyle.position, 'fixed');
  assert.equal(page.bodyStyle.top, '-360px');
  assert.equal(page.bodyStyle.left, '-12px');
  assert.equal(page.bodyStyle.paddingRight, '20px');
  assert.equal(page.rootStyle.overflow, 'hidden');

  const releaseInner = acquireModalScrollLock(page.browserWindow, page.pageDocument);
  releaseOuter();
  assert.equal(page.bodyStyle.position, 'fixed');
  assert.deepEqual(page.scrollCalls, []);

  releaseInner();
  assert.equal(page.bodyStyle.position, 'relative');
  assert.equal(page.bodyStyle.overflow, 'auto');
  assert.equal(page.bodyStyle.paddingRight, '4px');
  assert.equal(page.rootStyle.overflow, 'auto');
  assert.deepEqual(page.scrollCalls, [[12, 360]]);
  releaseInner();
  assert.deepEqual(page.scrollCalls, [[12, 360]]);
});

test('SMS-66 leaves existing padding untouched when no scrollbar is present', () => {
  const page = fakePage(0);
  const release = acquireModalScrollLock(page.browserWindow, page.pageDocument);
  assert.equal(page.bodyStyle.paddingRight, '4px');
  release();
  assert.deepEqual(page.scrollCalls, [[12, 360]]);
});
