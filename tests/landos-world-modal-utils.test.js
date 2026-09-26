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

test('explicit modal scroll owners remain the boundary even when they are not overflowing', () => {
  const { window, document } = createRuntime();
  const body = document.body;
  const calculator = {
    parentElement: body,
    scrollTop: 0,
    scrollHeight: 480,
    clientHeight: 300,
    matches() { return false; },
    getBoundingClientRect() { return { top: 0, bottom: 300 }; },
  };
  const modalBody = {
    parentElement: calculator,
    scrollTop: 0,
    scrollHeight: 300,
    clientHeight: 300,
    matches(selector) { return selector === '[data-modal-scroll-container]'; },
    getBoundingClientRect() { return { top: 0, bottom: 300 }; },
  };
  const input = {
    parentElement: modalBody,
    matches(selector) { return selector.includes('input'); },
    getBoundingClientRect() { return { top: 320, bottom: 360 }; },
  };
  body.parentElement = document.documentElement;
  window.getComputedStyle = (element) => ({
    position: element === calculator ? 'relative' : 'static',
    overflowY: element === calculator ? 'auto' : 'visible',
  });
  window.visualViewport = { height: 400, offsetTop: 80 };

  assert.equal(window.LandosWorldModalUtils.ensureFocusedElementVisible(input), false);
  assert.equal(modalBody.scrollTop, 0);
  assert.equal(calculator.scrollTop, 0);
});

test('an explicitly supplied modal scroll owner prevents fallback to the shell or document', () => {
  const { window, document } = createRuntime();
  const shell = {
    parentElement: document.body,
    scrollTop: 0,
    scrollHeight: 900,
    clientHeight: 300,
    matches() { return false; },
    getBoundingClientRect() { return { top: 0, bottom: 300 }; },
  };
  const modalBody = {
    parentElement: shell,
    scrollTop: 0,
    scrollHeight: 600,
    clientHeight: 300,
    contains(element) { return element === input; },
    matches(selector) { return selector === '[data-modal-scroll-container]'; },
    getBoundingClientRect() { return { top: 0, bottom: 300 }; },
  };
  const input = {
    parentElement: modalBody,
    matches(selector) { return selector.includes('input'); },
    getBoundingClientRect() { return { top: 320, bottom: 360 }; },
  };
  document.body.parentElement = document.documentElement;
  window.getComputedStyle = (element) => ({
    position: element === shell ? 'relative' : 'static',
    overflowY: element === shell ? 'auto' : 'visible',
  });
  window.visualViewport = { height: 400, offsetTop: 0 };

  assert.equal(window.LandosWorldModalUtils.ensureFocusedElementVisible(input, 16, modalBody), true);
  assert.ok(modalBody.scrollTop > 0);
  assert.equal(shell.scrollTop, 0);
  assert.equal(window.scrollY, 180);
});
