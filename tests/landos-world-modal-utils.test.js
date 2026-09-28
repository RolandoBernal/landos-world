import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/landos-world-modal-utils.js', import.meta.url), 'utf8');

function createRuntime() {
  const viewportListeners = new Map();
  const visualViewport = {
    height: 400,
    offsetTop: 0,
    addEventListener(type, listener) {
      if (!viewportListeners.has(type)) viewportListeners.set(type, new Set());
      viewportListeners.get(type).add(listener);
    },
    dispatch(type) {
      for (const listener of viewportListeners.get(type) || []) listener({ type });
    },
  };
  const document = {
    documentElement: { style: {} },
    body: { style: {} },
    listeners: new Map(),
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(listener);
    },
    dispatch(type, properties = {}) {
      const event = { type, ...properties };
      for (const listener of this.listeners.get(type) || []) listener(event);
    },
  };
  const window = {
    scrollX: 24,
    scrollY: 180,
    scrollTo(x, y) {
      this.scrollX = x;
      this.scrollY = y;
    },
    listeners: new Map(),
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(listener);
    },
    dispatch(type) {
      for (const listener of this.listeners.get(type) || []) listener({ type });
    },
    scrollBy(x, y) {
      this.scrollX += x;
      this.scrollY += y;
    },
    visualViewport,
    requestAnimationFrame(callback) {
      callback();
      return 0;
    },
  };
  vm.runInNewContext(source, { window, document });
  return { window, document, visualViewport };
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

test('visual-viewport-aligned modal descendants use the panned visual viewport for focus visibility', () => {
  const { window, document } = createRuntime();
  const body = document.body;
  const layer = {
    parentElement: body,
    matches() { return false; },
  };
  const visualViewport = {
    parentElement: layer,
    matches(selector) { return selector === '[data-modal-visual-viewport]'; },
  };
  const scrollOwner = {
    parentElement: visualViewport,
    scrollTop: 0,
    scrollHeight: 600,
    clientHeight: 300,
    matches(selector) { return selector === '[data-modal-scroll-container]'; },
    getBoundingClientRect() { return { top: 80, bottom: 480 }; },
  };
  const input = {
    parentElement: scrollOwner,
    matches(selector) { return selector.includes('input'); },
    getBoundingClientRect() { return { top: 470, bottom: 510 }; },
  };
  body.parentElement = document.documentElement;
  window.getComputedStyle = (element) => ({ position: element === layer ? 'fixed' : 'static', overflowY: 'auto' });
  window.visualViewport = { height: 400, offsetTop: 80 };

  assert.equal(window.LandosWorldModalUtils.ensureFocusedElementVisible(input), true);
  assert.equal(scrollOwner.scrollTop, 46);
  assert.equal(window.scrollY, 180);
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

test('user scroll intent suppresses delayed visibility corrections until focus moves to another field', () => {
  const { window, document, visualViewport } = createRuntime();
  const form = {
    nodeType: 1,
    parentElement: document.body,
    matches(selector) { return selector === '[data-preserve-document-scroll-on-viewport-pan]'; },
    closest(selector) { return selector === '[data-preserve-document-scroll-on-viewport-pan]' ? this : null; },
  };
  const makeInput = () => ({
    parentElement: form,
    matches(selector) { return selector.includes('input'); },
    closest(selector) { return selector === '[data-preserve-document-scroll-on-viewport-pan]' ? form : null; },
    getBoundingClientRect() { return { top: -240, bottom: -200 }; },
  });
  const firstInput = makeInput();
  document.activeElement = firstInput;
  document.dispatch('focusin', { target: firstInput });

  window.scrollY = 500;
  document.dispatch('wheel', { target: form, deltaY: 180 });
  window.dispatch('resize');
  visualViewport.dispatch('resize');
  visualViewport.dispatch('scroll');
  assert.equal(window.scrollY, 500);

  const secondInput = makeInput();
  document.activeElement = secondInput;
  document.dispatch('focusin', { target: secondInput });
  assert.equal(window.scrollY, 244);
});

test('touch scroll intent suppresses keyboard viewport corrections without blurring the focused input', () => {
  const { window, document, visualViewport } = createRuntime();
  const form = {
    nodeType: 1,
    parentElement: document.body,
    matches(selector) { return selector === '[data-preserve-document-scroll-on-viewport-pan]'; },
    closest(selector) { return selector === '[data-preserve-document-scroll-on-viewport-pan]' ? this : null; },
  };
  const input = {
    parentElement: form,
    matches(selector) { return selector.includes('input'); },
    closest(selector) { return selector === '[data-preserve-document-scroll-on-viewport-pan]' ? form : null; },
    getBoundingClientRect() { return { top: 80, bottom: 120 }; },
  };
  document.activeElement = input;
  window.scrollY = 620;
  document.dispatch('touchstart', { target: form, touches: [{ clientX: 120, clientY: 460 }] });
  document.dispatch('touchmove', { target: form, touches: [{ clientX: 118, clientY: 410 }] });
  window.dispatch('resize');
  visualViewport.dispatch('resize');
  visualViewport.dispatch('scroll');

  assert.equal(document.activeElement, input);
  assert.equal(window.scrollY, 620);
});

test('visual viewport panning still exposes focused controls inside an explicit modal scroll owner', () => {
  const { window, document, visualViewport } = createRuntime();
  const scrollOwner = {
    parentElement: document.body,
    scrollTop: 0,
    scrollHeight: 600,
    clientHeight: 300,
    matches(selector) { return selector === '[data-modal-scroll-container]'; },
    getBoundingClientRect() { return { top: 0, bottom: 300 }; },
  };
  const input = {
    parentElement: scrollOwner,
    matches(selector) { return selector.includes('input'); },
    getBoundingClientRect() { return { top: 320, bottom: 360 }; },
  };
  document.activeElement = input;

  visualViewport.dispatch('scroll');

  assert.equal(scrollOwner.scrollTop, 76);
  assert.equal(window.scrollY, 180);
});
