#!/usr/bin/env node
/**
 * verify-font-pack.mjs — verify the precompiled official font pack.
 *
 * Three independent checks:
 *   1) Byte-for-byte vs gcc: a few representative fonts (small / bitmap / big /
 *      CJK 300KB / "_all" aggregate) are compiled with gcc and their real C
 *      arrays are diffed against what convert-all-fonts.js decoded. The C
 *      array size is declared+1 because the compiler appends an implicit NUL;
 *      the font data is the bytes before it.
 *   2) New-vs-old path: fonts that also exist in demo/fonts/ as .bin (already
 *      validated against the C library) must decode identically from the new
 *      base64 modules.
 *   3) Smoke render: load a font from the pack, draw text, export P1 PBM.
 *
 * Usage:  node tools/verify-font-pack.mjs
 * Requires gcc for check 1.
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractFontFromC } from './convert-fonts.js';
import { U8g2, U8g2Font } from '../src/index.js';
import { toPBMP1 } from '../src/renderer/pbm.js';
import b5x7 from '../fonts/u8g2_font_5x7_tf.js';
import b10x20 from '../fonts/u8g2_font_10x20_tf.js';
import b6x10 from '../fonts/u8g2_font_6x10_tf.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const FONTDIR = 'R:/u8g2移植/u8g2/tools/font/build/single_font_files/';
const BUILD = here + '.font-verify-build/';
const demoFont = (name) => fileURLToPath(new URL(`../demo/fonts/${name}.bin`, import.meta.url));

let failed = false;
const bad = (msg) => { console.log('FAIL:', msg); failed = true; };

/* ---------- 1) gcc byte-for-byte ---------------------------------- */
const cases = [
  'u8g2_font_04b_03_tr.c',                   // 小 u8g2 字体
  'u8g2_font_amstrad_cpc_extended_8f.c',     // u8x8 位图字体
  'u8g2_font_10x20_tf.c',                    // 常用大字体
  'u8g2_font_wqy16_t_gb2312.c',              // 300KB CJK（#ifdef U8G2_USE_LARGE_FONTS）
  'u8g2_font_boutique_bitmap_7x7_t_all.c',   // "_all" 聚合字体（多 unicode 块）
];
mkdirSync(BUILD, { recursive: true });
console.log('[1] gcc 逐字节对拍:');
for (const file of cases) {
  copyFileSync(FONTDIR + file, BUILD + file);
  const f = extractFontFromC(readFileSync(FONTDIR + file, 'utf8'));
  const c = [
    '#include <stdio.h>', '#include <stdint.h>',
    '#define U8G2_FONT_SECTION(x)', '#define U8X8_FONT_SECTION(x)',
    `#include "${file}"`,
    'int main(void){',
    `  unsigned n = sizeof(${f.name});`,
    '  printf("%u\\n", n);',
    `  for (unsigned i = 0; i < n; i++) printf("%d ", (int)${f.name}[i]);`,
    '  printf("\\n"); return 0; }', '',
  ].join('\n');
  writeFileSync(BUILD + 'dump.c', c);
  try {
    /* 巨字体数组被 #ifdef 包裹；shell:false + 绝对路径，放大 maxBuffer（300KB 字体 dump ~1.2MB） */
    execSync('gcc -O0 -DU8G2_USE_LARGE_FONTS -I. -o dump.exe dump.c', { cwd: BUILD, stdio: 'pipe' });
    const out = execSync(BUILD + 'dump.exe', { encoding: 'utf8', shell: false, maxBuffer: 64 * 1024 * 1024 });
    const lines = out.trim().split('\n');
    const n = Number(lines[0]);
    const cbytes = lines.slice(1).join(' ').trim().split(/\s+/).map(Number);
    const data = cbytes.slice(0, n - 1);          // 去掉 C 隐式 NUL
    const ok = cbytes[n - 1] === 0 && data.length === f.bytes.length && data.every((b, i) => b === f.bytes[i]);
    console.log(`  ${file}: C sizeof=${n}, js=${f.bytes.length} -> ${ok ? 'YES' : 'NO'}`);
    if (!ok) bad(`${file} byte mismatch`);
  } catch (e) {
    bad(`${file}: gcc error ${String(e.message).split('\n')[0]}`);
  }
}
rmSync(BUILD, { recursive: true, force: true });

/* ---------- 2) 新模块 vs demo/fonts 已校验 .bin ------------------- */
console.log('[2] 新模块 vs 已校验 .bin:');
for (const [name, b64] of [['u8g2_font_5x7_tf', b5x7], ['u8g2_font_10x20_tf', b10x20], ['u8g2_font_6x10_tf', b6x10]]) {
  const ours = U8g2Font.fromBase64(b64).data;
  const old = readFileSync(demoFont(name));
  const ok = ours.length === old.length && ours.every((b, i) => b === old[i]);
  console.log(`  ${name}: ${ours.length}B vs ${old.length}B -> ${ok ? 'YES' : 'NO'}`);
  if (!ok) bad(`${name} differs from validated .bin`);
}

/* ---------- 3) 冒烟渲染 ------------------------------------------- */
console.log('[3] 冒烟渲染:');
U8g2Font.register('u8g2_font_5x7_tf', U8g2Font.fromBase64(b5x7));
U8g2Font.register('u8g2_font_10x20_tf', U8g2Font.fromBase64(b10x20));
const u = new U8g2({ width: 128, height: 64 });
u.clear();
u.setFont('u8g2_font_10x20_tf');
u.drawStr(0, 20, 'Hello');
u.setFont('u8g2_font_5x7_tf');
u.drawStr(0, 40, 'u8g2-js fonts');
u.sendBuffer();
const pixels = (toPBMP1(u).match(/1/g) ?? []).length;
console.log(`  drawn pixels = ${pixels} -> ${pixels > 100 ? 'OK' : 'FAIL'}`);
if (pixels <= 100) bad('smoke render produced too few pixels');

console.log(failed ? '\nVERIFY FAILED' : '\nALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
