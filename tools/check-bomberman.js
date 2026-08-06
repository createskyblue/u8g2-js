#!/usr/bin/env node
/**
 * check-bomberman.js
 *
 * Boot demo/bomberman/game.js in Node with DOM/canvas stubs and verify the
 * game advances: menu -> level -> play, and the player can move.
 *
 *   node tools/check-bomberman.js
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
const screen = { width: 0, height: 0, getContext: () => fakeCtx() };
let raf = null;
globalThis.document = {
  getElementById: (id) => (id === 'screen' ? screen : null),
  createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }),
  addEventListener() {},
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
let t = 0;
globalThis.performance = { now: () => (t += 10) }; /* deterministic clock */
globalThis.requestAnimationFrame = (fn) => { raf = fn; };
globalThis.setInterval = () => 0;

await import(new URL('../demo/bomberman/game.js', import.meta.url));
const run = (n) => { for (let i = 0; i < n; i++) raf?.(); };

const bom = globalThis.__bomberman;
if (!bom) { console.error('FAIL: window.__bomberman missing'); process.exit(1); }
if (screen.width === 0) { console.error('FAIL: canvas not attached'); process.exit(1); }

run(5);
if (bom.gameState() !== 'menu') { console.error('FAIL: expected menu, got', bom.gameState()); process.exit(1); }
console.log('boot: menu OK, canvas', screen.width + 'x' + screen.height);

/* start the game (A / space) */
bom.press(' '); run(3); bom.release(' ');
/* advance past the 1000ms "LEVEL" screen into play */
let guard = 0;
while (bom.gameState() !== 'play' && guard++ < 2000) raf?.();
if (bom.gameState() !== 'play') { console.error('FAIL: expected play, got', bom.gameState()); process.exit(1); }
const [x0, y0] = bom.pos();
if (bom.life() !== 3) { console.error('FAIL: expected LIFE 3, got', bom.life()); process.exit(1); }
console.log(`play: started, LIFE=${bom.life()}, player at (${x0},${y0})`);

/* move right a few frames */
bom.press('ArrowRight'); run(5); bom.release('ArrowRight');
const [x1] = bom.pos();
if (x1 <= x0) { console.error('FAIL: player did not move right', x0, '->', x1); process.exit(1); }
console.log('move: player moved right', x0, '->', x1);

console.log('OK: Bomberman boots and plays');
