import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/landos-world-modal-utils.js', import.meta.url), 'utf8');

function createRuntime() {
  const document = {
    documentElement: { style: {} },
    body: { style: {} },
    addEventListener() {},
  };
  const window = {
    scrollX: 24,
    scrollY: 180,
    scrollTo(x, y) {
      this.scrollX = x;
      this.scrollY = y;
    },
    addEventListener() {},
  };
  vm.runInNewContext(source, { window, document });
  return { window, document };
}

test('modal scroll lock restores the exact document state after nested locks close', () => {
  const { window, document } = createRuntime();
  document.documentElement.style.overflow = 'auto';
  document.body.style.position = 'relative';
  const outer = window.LandosWorldModalUtils.lockBackgroundScroll('outer');
  const inner = window.LandosWorldModalUtils.lockBackgroundScroll('inner');

  assert.equal(document.documentElement.style.overflow, 'hidden');
  assert.equal(document.body.style.position, 'fixed');
  assert.equal(document.body.style.top, '-180px');

  window.LandosWorldModalUtils.unlockBackgroundScroll(inner);
  assert.equal(document.body.style.position, 'fixed');
  window.LandosWorldModalUtils.unlockBackgroundScroll(outer);

  assert.equal(document.documentElement.style.overflow, 'auto');
  assert.equal(document.body.style.position, 'relative');
  assert.equal(window.scrollX, 24);
  assert.equal(window.scrollY, 180);
});

test('unknown modal lock tokens do not release an active lock', () => {
  const { window, document } = createRuntime();
  const token = window.LandosWorldModalUtils.lockBackgroundScroll('modal');
  window.LandosWorldModalUtils.unlockBackgroundScroll('not-owned');
  assert.equal(document.body.style.position, 'fixed');
  window.LandosWorldModalUtils.unlockBackgroundScroll(token);
  assert.equal(document.body.style.position, undefined);
});
