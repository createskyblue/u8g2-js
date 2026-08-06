#!/usr/bin/env node
/**
 * check-demo.js
 *
 * Boot demo/demo.js (ESM, the same page you open in the browser via a live
 * server) in Node with minimal DOM/canvas stubs, and verify the default sketch
 * runs without errors.
 *
 *   node tools/check-demo.js
 */
import { fileURLToPath } from 'node:url';

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
    _value: '', _checked: false, _innerHTML: '', textContent: '',
    style: {}, children: [], files: [], listeners: {},
    classList: { toggle() {}, add() {}, remove() {} },
    get value() { return this._value; },
    set value(v) { this._value = String(v); },
    get checked() { return this._checked; },
    set checked(v) { this._checked = !!v; },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = v; },
    getContext: () => fakeCtx(),
    appendChild(c) { this.children.push(c); return c; },
    append(...cs) { this.children.push(...cs); },
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    set onclick(fn) { this._onclick = fn; },
    get onclick() { return this._onclick; },
    set onchange(fn) { this._onchange = fn; },
    set oninput(fn) { this._oninput = fn; },
  };
}

const els = {};
globalThis.document = {
  getElementById(id) { return (els[id] ||= makeEl()); },
  createElement: (tag) => makeEl(tag),
  addEventListener(ev, fn) { if (ev === 'DOMContentLoaded') globalThis.__domReady = fn; },
  querySelectorAll: () => [],
  querySelector: () => makeEl(),
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.performance = { now: () => Date.now() % 1000000 };
globalThis.setInterval = () => 0; /* 动画循环：让进程能退出，run() 仍同步执行一次 */
globalThis.requestAnimationFrame = (fn) => { fn(Date.now() % 1000000); return 0; };

try {
  await import(new URL('../demo/demo.js', import.meta.url));
  globalThis.__domReady?.();
} catch (err) {
  console.error('DEMO BOOT FAILED:', err);
  process.exit(1);
}

if (!globalThis.u8g2demo) {
  console.error('DEMO BOOT FAILED: window.u8g2demo missing');
  process.exit(1);
}
if (!/ok/.test(els['statusMsg']?.textContent)) {
  console.error('DEMO RUN FAILED: statusMsg =', JSON.stringify(els['statusMsg']?.textContent));
  process.exit(1);
}
console.log('demo boots and runs the default sketch: OK');
process.exit(0);
