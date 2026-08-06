#!/usr/bin/env node
/**
 * convert-fonts.js
 *
 * Convert U8G2 fonts from their generated C files into runtime-loadable
 * data for u8g2-js.  A font is just a byte array, so we only need to decode
 * the C string literal.
 *
 * Usage:
 *   node tools/convert-fonts.js <font.c> [-o outDir] [--format js|bin|json] [--name NAME]
 *   node tools/convert-fonts.js --batch <dir> [-o outDir] [--format js|bin|json]
 *
 * Default --format is "bin,js": every conversion writes both the raw bytes
 * (.bin) and the import-ready base64 module (.js), so the JS comes out together
 * without any extra flag.
 *
 * Examples:
 *   node tools/convert-fonts.js ../u8g2/tools/font/build/single_font_files/u8g2_font_5x7_tf.c -o demo/fonts
 *   node tools/convert-fonts.js ../u8g2/tools/font/build/single_font_files/u8g2_font_5x7_tf.c -o demo/fonts --format bin
 *   node tools/convert-fonts.js --batch ../u8g2/tools/font/build/single_font_files -o my-fonts
 *
 * Output (default bin,js):
 *   --format js   : <name>.js  -> `export const <name> = "<base64>";`
 *   --format bin  : <name>.bin -> raw font bytes (fetch -> Uint8Array)
 *   --format json : <name>.json -> { name, size, base64 }
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, basename, extname, join } from 'node:path';
import { parseCStringBytes } from '../src/font.js';

/* ------------------------------------------------------------------ */

/**
 * Find the first "const uint8_t NAME[..] U8G2/U8X8_FONT_SECTION("...") = "...."
 * in a C file and decode it into bytes.
 *
 * Generated font files split the long string literal into many adjacent
 * fragments, so we collect every fragment until the statement ends.
 * The declared array size "[N]" is captured so callers can verify the
 * decoded byte length matches what the C compiler would enforce.
 * @returns {{name:string, bytes:Uint8Array, size:number|null}|null}
 */
export function extractFontFromC(content) {
  const headRe = /const\s+uint8_t\s+([A-Za-z_]\w*)\s*(?:\[\s*(\d*)\s*\])?\s*(?:U8G2|U8X8)_FONT_SECTION\s*\(\s*"[^"]*"\s*\)\s*=/;
  const m = content.match(headRe);
  if (!m) return null;
  const name = m[1];
  const size = m[2] ? Number(m[2]) : null;

  let i = content.indexOf('"', m.index + m[0].length);
  if (i === -1) return null;
  const frags = [];
  while (i !== -1) {
    let j = i + 1;
    let raw = '';
    while (j < content.length) {
      const c = content[j];
      if (c === '\\') {
        /* copy the full escape (octal, hex or simple) verbatim */
        raw += c + content[j + 1];
        j += 2;
        continue;
      }
      if (c === '"') break;
      raw += c;
      j++;
    }
    frags.push(raw);
    let k = j + 1;
    while (k < content.length && /\s/.test(content[k])) k++;
    if (content[k] !== '"') break;
    i = k;
  }
  return { name, bytes: parseCStringBytes(frags.join('')), size };
}

/** Batch: extract every font from a set of .c files. */
export function extractFontsFromDir(dir) {
  const out = [];
  for (const file of readdirSync(dir)) {
    if (extname(file).toLowerCase() !== '.c') continue;
    const content = readFileSync(join(dir, file), 'utf8');
    const f = extractFontFromC(content);
    if (f) out.push(f);
  }
  return out;
}

function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return Buffer.from(bin, 'binary').toString('base64');
}

function writeFormats(font, outDir, formats) {
  const name = font.name;
  if (formats.includes('bin')) {
    writeFileSync(join(outDir, `${name}.bin`), font.bytes);
  }
  if (formats.includes('js')) {
    const b64 = bytesToBase64(font.bytes);
    const js =
`/* Converted from u8g2 font "${name}" (${font.bytes.length} bytes).
   Load at runtime: U8g2Font.fromBase64(u8g2_font_xxx) or setFont(name). */
export const ${name} = "${b64}";
`;
    writeFileSync(join(outDir, `${name}.js`), js);
  }
  if (formats.includes('json')) {
    const b64 = bytesToBase64(font.bytes);
    writeFileSync(join(outDir, `${name}.json`), JSON.stringify({ name, size: font.bytes.length, base64: b64 }, null, 2));
  }
}

/* ------------------------------------------------------------------ */

function usage() {
  console.log(`
convert-fonts.js — convert U8G2 .c font files to loadable data

  node tools/convert-fonts.js <font.c> [-o outDir] [--format js|bin|json]
  node tools/convert-fonts.js --batch <dir> [-o outDir] [--format js|bin|json]

Default --format is "bin,js" (raw bytes + import-ready JS module, generated together).
`);
}

function parseArgs(argv) {
  const args = { formats: ['bin', 'js'], outDir: '.' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--format') {
      args.formats = (argv[++i] || 'bin').split(',');
    } else if (a === '--batch') {
      args.batch = true;
    } else if (a === '-o' || a === '--out') {
      args.outDir = argv[++i];
    } else if (a === '--name') {
      args.name = argv[++i];
    } else if (a === '-h' || a === '--help') {
      args.help = true;
    } else {
      positional.push(a);
    }
  }
  args.input = positional[0];
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.input && !args.batch)) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  mkdirSync(args.outDir, { recursive: true });

  let fonts = [];
  if (args.batch) {
    fonts = extractFontsFromDir(args.input);
    console.log(`extracted ${fonts.length} fonts from ${args.input}`);
  } else {
    const content = readFileSync(args.input, 'utf8');
    const f = extractFontFromC(content);
    if (!f) {
      console.error(`no font array found in ${args.input}`);
      process.exit(1);
    }
    if (args.name) f.name = args.name;
    fonts.push(f);
    console.log(`extracted "${f.name}" (${f.bytes.length} bytes)`);
  }

  for (const f of fonts) writeFormats(f, args.outDir, args.formats);

  console.log(`wrote ${fonts.length} font(s) as [${args.formats.join(',')}] to ${resolve(args.outDir)}`);
}

/* Only run as a CLI when invoked directly; imported by convert-all-fonts.js. */
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
