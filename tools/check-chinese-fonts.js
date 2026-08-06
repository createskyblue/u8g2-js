#!/usr/bin/env node
/**
 * check-chinese-fonts.js
 *
 * Boot demo/chinese-fonts/demo.js in Node with DOM/canvas stubs and verify the
 * on-demand-loading page works: 18 family tabs, dynamic import of fonts, and
 * the single 1920×1080 @ exactly-2× canvas (3840×2160, no CSS scaling).
 *
 *   node tools/check-chinese-fonts.js
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

function fakeCtx() {
  return {
    canvas: null,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, imageSmoothingEnabled: false,
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData() {}, drawImage() {}, fillRect() {}, strokeRect() {}, clearRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {},
    getImageData(x, y, w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
  };
}
function makeEl() {
  return {
    className: '', textContent: '', style: {}, width: 0, height: 0, children: [], listeners: {},
    classList: { toggle() {}, add() {}, remove() {} },
    getContext: () => fakeCtx(),
    appendChild(c) { this.children.push(c); return c; },
    append(...cs) { this.children.push(...cs); },
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
  };
}
const screen = makeEl();
const tabsEl = makeEl();
const status = makeEl();
const nameEl = makeEl();
globalThis.document = {
  getElementById: (id) => ({ screen, tabs: tabsEl, status, name: nameEl })[id],
  createElement: () => makeEl(),
  addEventListener() {},
  querySelectorAll: (sel) => (sel === '.tab' ? tabsEl.children : []),
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.performance = { now: () => Date.now() % 1000000 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitStatus(prefix) {
  for (let i = 0; i < 600; i++) {
    if (status.textContent.startsWith(prefix)) return;
    await sleep(50);
  }
  throw new Error(`timeout waiting for status "${prefix}", got "${status.textContent}"`);
}

await import(new URL('../demo/chinese-fonts/demo.js', import.meta.url));

/* 首次加载（SimSun）是异步的 */
await waitStatus('已加载');
if (screen.width !== 3840 || screen.height !== 2160) {
  console.error(`FAIL: canvas must be exactly 3840x2160, got ${screen.width}x${screen.height}`);
  process.exit(1);
}
if (tabsEl.children.length !== 18) {
  console.error(`FAIL: expected 18 family tabs, got ${tabsEl.children.length}`);
  process.exit(1);
}
console.log(`boot: 18 tabs, single canvas ${screen.width}x${screen.height}, first family "${nameEl.textContent}"`);

/* 切到第二个家族，验证按需动态加载 */
tabsEl.children[1].listeners.click[0]();
await waitStatus('已加载');
console.log(`switch: dynamic import OK, now on "${nameEl.textContent}"`);
if (!nameEl.textContent.includes('MapleMono')) {
  console.error(`FAIL: expected MapleMono Light, got "${nameEl.textContent}"`);
  process.exit(1);
}
console.log('OK: on-demand loading works');
