#!/usr/bin/env node
/**
 * check-demo.js
 *
 * Boot the standalone demo bundle in Node with minimal DOM/canvas stubs to
 * catch runtime errors (missing element ids, API misuse, bundle ordering).
 *
 *   node tools/build-demo.js && node tools/check-demo.js
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'demo', 'demo-standalone.html'), 'utf8');
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) { console.error('no inline module found'); process.exit(1); }

/* ------------------------------------------------------------------ */
/* fake 2D context                                                     */

function fakeCtx() {
  return {
    canvas: null,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, imageSmoothingEnabled: false,
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData() {}, drawImage() {}, fillRect() {}, strokeRect() {}, clearRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {},
    getImageData(x, y, w, h) {
      return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    },
  };
}

/* ------------------------------------------------------------------ */
/* fake DOM element                                                    */

function makeEl(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    _value: '', _checked: false, _innerHTML: '',
    style: { display: '' },
    children: [],
    get value() { return this._value; },
    set value(v) { this._value = String(v); },
    get checked() { return this._checked; },
    set checked(v) { this._checked = !!v; },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = v; },
    getContext: () => fakeCtx(),
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {},
    set onclick(fn) { this._onclick = fn; },
    get onclick() { return this._onclick; },
    set onchange(fn) { this._onchange = fn; },
    set oninput(fn) { this._oninput = fn; },
    files: [],
    textContent: '',
  };
}

const els = {};
globalThis.document = {
  getElementById(id) { return (els[id] ||= makeEl()); },
  createElement: (tag) => makeEl(tag),
  addEventListener(ev, fn) { if (ev === 'DOMContentLoaded') globalThis.__domReady = fn; },
};
globalThis.window = globalThis;
globalThis.performance = { now: () => Date.now() % 1000000 };

/* ------------------------------------------------------------------ */

try {
  const url = 'data:text/javascript;base64,' + Buffer.from(m[1]).toString('base64');
  await import(url);
  globalThis.__domReady?.();
} catch (err) {
  console.error('DEMO BOOT FAILED:', err);
  process.exit(1);
}

if (!globalThis.u8g2demo) {
  console.error('DEMO BOOT FAILED: window.u8g2demo missing');
  process.exit(1);
}

/* the default sketch should have run (rebuildDisplay -> run) */
const msgEl = els['statusMsg'];
const statusOk = msgEl && /ok/.test(msgEl.textContent);
if (!statusOk) {
  console.error('DEMO RUN FAILED: statusMsg =', JSON.stringify(msgEl?.textContent));
  process.exit(1);
}
console.log('demo boots and runs the default sketch: OK');
