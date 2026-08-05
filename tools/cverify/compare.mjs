/* Compare the JS port against the real C library byte-for-byte.
   Run after build.sh has produced the c_*.bin reference files. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { U8g2, U8g2Font } from '../../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const font = await U8g2Font.load(join(HERE, '../../demo/fonts/u8g2_font_5x7_tf.bin'));
const fontUnifont = await U8g2Font.load(join(HERE, '../../demo/fonts/u8g2_font_unifont_t_symbols.bin'));
const fontCnFull = await U8g2Font.load(join(HERE, '../../demo/fonts/chinese_full_12.bin'));

const XBM = [0x81, 0x42, 0x24, 0x18, 0x24, 0x42, 0x81, 0x00, 0x18];

function scenario(u8g2, s) {
  switch (s) {
    case 1:
      u8g2.setFont(font);
      u8g2.drawStr(0, 10, 'Hello');
      u8g2.drawBox(0, 20, 10, 5);
      u8g2.drawFrame(20, 20, 10, 5);
      u8g2.drawRBox(40, 20, 12, 8, 3);
      u8g2.drawRFrame(60, 20, 12, 8, 3);
      u8g2.drawLine(0, 40, 30, 55);
      u8g2.drawLine(0, 55, 30, 40);
      break;
    case 2:
      u8g2.drawCircle(20, 20, 8, 0x0f);
      u8g2.drawDisc(50, 20, 8, 0x0f);
      u8g2.drawEllipse(80, 20, 12, 6, 0x0f);
      u8g2.drawFilledEllipse(110, 20, 10, 8, 0x0f);
      u8g2.drawArc(20, 50, 8, 64, 128);
      break;
    case 3:
      u8g2.drawTriangle(10, 40, 30, 10, 50, 40);
      break;
    case 4:
      u8g2.setFont(font);
      u8g2.setDrawColor(2);
      u8g2.drawBox(0, 0, 32, 16);
      u8g2.drawBox(0, 0, 32, 16);
      u8g2.setDrawColor(1);
      u8g2.setFontMode(1);
      u8g2.drawStr(0, 10, 'ABC');
      u8g2.setFontMode(0);
      u8g2.drawStr(0, 20, 'XYZ');
      break;
    case 5:
      u8g2.setFont(font);
      u8g2.setClipWindow(10, 10, 40, 30);
      u8g2.drawBox(0, 0, 64, 40);
      u8g2.setMaxClipWindow();
      u8g2.drawFrame(20, 20, 10, 5);
      break;
    case 6:
      u8g2.setFont(font);
      u8g2.setFontDirection(1);
      u8g2.drawStr(20, 20, 'ABC');
      u8g2.setFontDirection(0);
      u8g2.drawGlyphX2(40, 20, 0x41);
      u8g2.drawStrX2(60, 20, 'Hi');
      break;
    case 7:
      u8g2.drawXBM(10, 10, 8, 9, new Uint8Array(XBM));
      u8g2.setBitmapMode(1);
      u8g2.drawXBM(20, 10, 8, 9, new Uint8Array(XBM));
      break;
    case 8:
      u8g2.setFont(font);
      u8g2.drawButtonUTF8(30, 20, 0x02 | 0x40 /* U8G2_BTN_BW2|U8G2_BTN_HCENTER */, 0, 3, 1, 'OK');
      break;
    case 9:
      u8g2.setFont(font);
      u8g2.drawGlyph(0, 20, 0x5a);
      break;
    case 10:
      u8g2.setFont(font);
      u8g2.setFontMode(1);
      u8g2.drawGlyph(0, 20, 0x5a);
      break;
    case 11:
      u8g2.setFont(font);
      u8g2.drawStr(0, 20, 'XYZ');
      break;
    case 12:
      u8g2.setFont(font);
      u8g2.drawGlyph(0, 20, 0x58);
      u8g2.drawGlyph(5, 20, 0x59);
      u8g2.drawGlyph(10, 20, 0x5a);
      break;
    case 14:
      u8g2.setFont(fontUnifont);
      u8g2.drawGlyph(0, 16, 0x2605);
      u8g2.drawGlyph(20, 16, 0x2192);
      u8g2.drawGlyph(40, 16, 0x2660);
      u8g2.drawGlyph(60, 16, 0x20ac);
      break;
    case 15:
      u8g2.setFont(fontCnFull);
      u8g2.drawUTF8(0, 16, '你好世界，温度传感器 U8G2 测试！');
      u8g2.drawUTF8(0, 40, '龘靐齉爩 天气晴朗 123ABC');
      u8g2.drawUTF8(0, 60, '长命百岁万事如意');
      break;
    default: break;
  }
}

const runs = [];
for (let s = 1; s <= 15; s++) {
  if (s === 13) continue; /* scenario 13 dumps the font, not a buffer */
  runs.push([s, 0]);
}
for (let r = 1; r <= 3; r++) runs.push([1, r]);

let pass = 0, fail = 0;

/* scenario 13: font data must be byte-identical to the C array */
{
  const raw = new Uint8Array(readFileSync(join(HERE, 'c_s13_r0.bin')));
  const cFont = raw.subarray(0, 1612);
  let diffs = 0;
  for (let i = 0; i < Math.min(cFont.length, font.data.length); i++) {
    if (cFont[i] !== font.data[i]) diffs++;
  }
  const ok = diffs === 0 && cFont.length === font.data.length + 1 && cFont[1611] === 0;
  console.log(`font data vs C array: ${ok ? 'PASS' : 'FAIL'} (${diffs} byte diffs)`);
  if (!ok) fail++; else pass++;
}

for (const [s, r] of runs) {
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f', rotation: r });
  u8g2.setFont(font);
  u8g2.clearBuffer();
  scenario(u8g2, s);
  u8g2.sendBuffer();

  const file = join(HERE, `c_s${s}_r${r}.bin`);
  const cBytes = new Uint8Array(readFileSync(file)).subarray(0, 1024);
  const jsBytes = u8g2.displayMemory;

  let diff = 0;
  for (let i = 0; i < 1024; i++) if (cBytes[i] !== jsBytes[i]) diff++;

  const status = diff === 0 ? 'PASS' : 'FAIL';
  if (diff === 0) pass++; else fail++;
  console.log(`scenario ${s} rotation ${r}: ${status} (${diff} bytes differ)`);
  if (diff > 0) {
    /* show first few differing bytes */
    let shown = 0;
    for (let i = 0; i < 1024 && shown < 5; i++) {
      if (cBytes[i] !== jsBytes[i]) {
        console.log(`  byte ${i}: C=0x${cBytes[i].toString(16).padStart(2, '0')} JS=0x${jsBytes[i].toString(16).padStart(2, '0')}`);
        shown++;
      }
    }
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
