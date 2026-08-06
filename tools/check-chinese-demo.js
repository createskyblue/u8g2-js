#!/usr/bin/env node
/**
 * check-chinese-demo.js
 *
 * Boot the Chinese-font test page bundle (demo/chinese-fonts-demo.html) in Node
 * with minimal DOM/canvas stubs, and verify it builds 4 font panels without
 * runtime errors.
 *
 *   node tools/build-chinese-demo.js && node tools/check-chinese-demo.js
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'demo', 'chinese-fonts-demo.html'), 'utf8');
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) { console.error('no inline module found'); process.exit(1); }

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

function makeEl(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    children: [],
    textContent: '',
    getContext: () => fakeCtx(),
    appendChild(c) { this.children.push(c); return c; },
    append(...cs) { this.children.push(...cs); },
  };
}

const panels = [];
const host = makeEl('div');
host.appendChild = (c) => { panels.push(c); return c; };

globalThis.document = {
  getElementById(id) { return id === 'panels' ? host : makeEl(); },
  createElement: (tag) => makeEl(tag),
  addEventListener() {},
};
globalThis.window = globalThis;
globalThis.performance = { now: () => Date.now() % 1000000 };

try {
  const url = 'data:text/javascript;base64,' + Buffer.from(m[1]).toString('base64');
  await import(url);
} catch (err) {
  console.error('CHINESE DEMO BOOT FAILED:', err);
  process.exit(1);
}

const names = panels.map((p) => p.children[0]?.textContent || '?');
console.log(`chinese demo boots: ${panels.length} panels`);
for (const n of names) console.log('  ', n);
if (panels.length !== 4) {
  console.error('FAIL: expected 4 panels');
  process.exit(1);
}
const ok = ['chinese_full_12', 'chinese_full_16', 'chinese_full_24', 'chinese_full_32']
  .every((nm) => names.some((n) => n.includes(nm)));
if (!ok) {
  console.error('FAIL: missing a font panel');
  process.exit(1);
}
console.log('ALL 4 FONT PANELS OK');
