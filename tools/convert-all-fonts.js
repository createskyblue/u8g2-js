#!/usr/bin/env node
/**
 * convert-all-fonts.js — precompile EVERY official u8g2 font into JS.
 *
 * The official fonts already exist as byte arrays in the generated C files
 * (tools/font/build/single_font_files in the u8g2 repo). This script decodes
 * each C array verbatim and emits one ESM module per font:
 *
 *   fonts/u8g2_font_5x7_tf.js   exports the font bytes as a base64 string
 *   fonts/index.json            manifest { name, file, size, glyphs }
 *
 * The bytes are taken straight from the C array, so they are byte-for-byte
 * identical to what gets compiled onto a real device. Each font is verified
 * against the array size "[N]" declared in its C header (which the C compiler
 * enforces) — a mismatch means our decoder is wrong.
 *
 * Usage:
 *   node tools/convert-all-fonts.js [<single_font_files dir>] [--out <dir>]
 *
 * Defaults: src = ../u8g2/tools/font/build/single_font_files
 *           out = <repo>/fonts
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFontFromC } from './convert-fonts.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const DEFAULT_SRC = resolve(ROOT, '..', 'u8g2', 'tools', 'font', 'build', 'single_font_files');
const DEFAULT_OUT = join(ROOT, 'fonts');

const args = process.argv.slice(2);
const SRC = args[0] || DEFAULT_SRC;
const OUT = join(ROOT, (args.find((a, i) => a === '--out' && args[i + 1]) ? args[args.indexOf('--out') + 1] : 'fonts'));

function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return Buffer.from(bin, 'binary').toString('base64');
}

/* The first byte of every u8g2 font is glyph_cnt in font_info_t. */
function glyphCount(bytes) {
  return bytes.length > 0 ? bytes[0] : 0;
}

mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.endsWith('.c')).sort();
const manifest = [];
const failures = [];
const mismatches = [];
let totalBytes = 0;
let totalJS = 0;

for (const file of files) {
  const content = readFileSync(join(SRC, file), 'utf8');
  const f = extractFontFromC(content);
  if (!f) {
    failures.push(file);
    continue;
  }
  /* C 数组声明长度比字面量多 1：编译器加的隐式 NUL，不属于字体数据。 */
  if (f.size !== null && f.bytes.length !== f.size && f.bytes.length !== f.size - 1) {
    mismatches.push({ file, declared: f.size, got: f.bytes.length });
  }

  const b64 = bytesToBase64(f.bytes);
  const js =
`/* u8g2 official font: ${f.name} (${f.bytes.length} bytes, ${glyphCount(f.bytes)} glyphs)
 * Converted verbatim from ${file}; byte-for-byte identical to the device build.
 * Usage:
 *   import b64 from 'u8g2-js/fonts/${f.name}.js';
 *   const font = U8g2Font.fromBase64(b64);   // or U8g2Font.register('${f.name}', font)
 */
const ${f.name} = "${b64}";
export { ${f.name} };
export default ${f.name};
`;
  writeFileSync(join(OUT, `${f.name}.js`), js);

  manifest.push({ name: f.name, file: `${f.name}.js`, size: f.bytes.length, glyphs: glyphCount(f.bytes) });
  totalBytes += f.bytes.length;
  totalJS += js.length;
}

writeFileSync(
  join(OUT, 'index.json'),
  JSON.stringify(
    {
      source: 'u8g2 tools/font/build/single_font_files',
      count: manifest.length,
      totalBytes,
      generatedAt: new Date().toISOString().slice(0, 10),
      fonts: manifest,
    },
    null,
    2
  )
);

console.log(`source: ${SRC}`);
console.log(`out:    ${OUT}`);
console.log(`converted ${manifest.length}/${files.length} fonts, ${totalBytes} bytes of font data`);
console.log(`total js output: ${(totalJS / 1048576).toFixed(2)} MiB`);
if (mismatches.length) {
  console.log(`WARN ${mismatches.length} size mismatches (declared vs decoded):`);
  for (const m of mismatches) console.log(`  ${m.file}: declared ${m.declared}, got ${m.got}`);
} else {
  console.log('size check: all decoded lengths match the declared C array sizes');
}
if (failures.length) {
  console.log(`WARN ${failures.length} files did not parse:`);
  for (const f of failures) console.log(`  ${f}`);
} else {
  console.log('parse: all files decoded');
}
