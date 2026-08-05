/**
 * u8g2-js test suite (Node, self-contained — no C compiler needed).
 *
 * The same scenarios are also cross-validated byte-for-byte against the
 * real U8G2 C library by tools/cverify/build.sh; these tests lock in the
 * behaviour independently.
 *
 * Run:  node --test test/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  U8g2, U8g2Font,
  PRESETS, listPresets,
  toPBM, parsePBM, pixelAt,
  U8G2_DRAW_ALL, U8G2_R1, U8G2_R2, U8G2_R3,
} from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = join(HERE, '..', 'demo', 'fonts');

async function loadFont(name) {
  return U8g2Font.load(join(FONT_DIR, name));
}

/* helper: read a pixel from a display memory */
const px = (u8g2, x, y) => pixelAt(u8g2, x, y);

/* =================================================================== */
/* Fonts                                                               */

test('5x7 font header parses correctly', async () => {
  const f = await loadFont('u8g2_font_5x7_tf.bin');
  const i = f.info;
  assert.equal(i.glyph_cnt, 191);
  assert.equal(i.bbx_mode, 0);
  assert.equal(i.max_char_width, 5);
  assert.equal(i.max_char_height, 7);
  assert.equal(i.ascent_A, 6);
  assert.equal(i.descent_g, -1);   /* signed */
  assert.equal(i.y_offset, -1);
  assert.equal(i.bits_per_char_width, 3);
  assert.equal(f.data.length, 1611);
});

test('font factories: fromArray / fromBase64 / fromC agree', async () => {
  const f = await loadFont('u8g2_font_5x7_tf.bin');
  const fromB64 = U8g2Font.fromBase64(f.toBase64());
  const fromArr = U8g2Font.fromArray(f.data);
  assert.deepEqual(Array.from(fromB64.data), Array.from(f.data));
  assert.deepEqual(Array.from(fromArr.data), Array.from(f.data));

  /* always 3-digit octal so consecutive escapes never merge */
  const cStr = Array.from(f.data, (b) => '\\' + b.toString(8).padStart(3, '0')).join('');
  const fromC = U8g2Font.fromC(cStr);
  assert.deepEqual(Array.from(fromC.data), Array.from(f.data));
});

test('glyph lookup + props (5x7)', async () => {
  const f = await loadFont('u8g2_font_5x7_tf.bin');
  const H = f.getGlyphProps(0x48);
  assert.deepEqual(H, { width: 4, height: 6, ox: 0, oy: 0, dx: 5 });
  assert.equal(f.hasGlyph(0x48), true);
  assert.equal(f.hasGlyph(0x48 + 1), true); /* 'I' */
  assert.equal(f.hasGlyph(0x1000), false);  /* out of range, no hang */
  assert.equal(f.getGlyphProps(0xffff), null);
});

test('unicode font: 531 glyphs incl. 307 non-ASCII', async () => {
  const f = await loadFont('u8g2_font_unifont_t_symbols.bin');
  assert.equal(f.hasGlyph(0x25a0), true);  /* black square */
  assert.equal(f.hasGlyph(0x2605), true);  /* star */
  assert.equal(f.hasGlyph(0x2660), true);  /* spade */
  assert.equal(f.hasGlyph(0x20ac), true);  /* euro */
  assert.equal(f.hasGlyph(0x2302), false); /* not in this subset */
  assert.equal(f.hasGlyph(0xfffff), false);
});

test('full CJK font: coverage + Chinese rendering', async () => {
  const f = await loadFont('chinese_full_12.bin');
  /* full charset: CJK + Latin-1 + symbols + punctuation */
  assert.equal(f.hasGlyph(0x4e2d), true);  /* 中 */
  assert.equal(f.hasGlyph(0x9f98), true);  /* 龘 (rare) */
  assert.equal(f.hasGlyph(0x2103), true);  /* ℃ */
  assert.equal(f.hasGlyph(0x00b0), true);  /* ° */
  assert.equal(f.hasGlyph(0x2014), true);  /* — */
  assert.equal(f.hasGlyph(0xff0c), true);  /* ， */

  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.setFont(f);
  assert.equal(u8g2.isAllValidUTF8('你好，世界！温度 25℃'), 1);
  u8g2.drawUTF8(0, 12, '你好，世界！');
  let cnt = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) cnt += px(u8g2, x, y);
  assert.ok(cnt > 100, `Chinese text should draw many pixels, got ${cnt}`);
});

/* =================================================================== */
/* Text                                                                 */

test('drawStr baseline positioning (top = baseline - (h + yo))', async () => {
  const f = await loadFont('u8g2_font_5x7_tf.bin');
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.setFont(f);
  u8g2.drawStr(0, 10, 'H');            /* baseline y=10, H h=6, top=4 */
  assert.equal(px(u8g2, 0, 4), 1);     /* left bar */
  assert.equal(px(u8g2, 2, 4), 0);     /* gap */
  assert.equal(px(u8g2, 0, 3), 0);     /* above the glyph */
  assert.equal(px(u8g2, 3, 6), 1);     /* right bar at crossbar row */
});

test('getStrWidth / getUTF8Width', async () => {
  const f = await loadFont('u8g2_font_5x7_tf.bin');
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.setFont(f);
  assert.equal(u8g2.getStrWidth('Hello'), 24);
  assert.equal(u8g2.getUTF8Width('Hello'), 24);
  assert.equal(u8g2.getStrWidth(''), 0);
  assert.equal(u8g2.getGlyphWidth(0x48), 5);
  assert.equal(u8g2.getXOffsetGlyph(0x48), 0);
});

test('drawUTF8 with unicode symbol font', async () => {
  const f = await loadFont('u8g2_font_unifont_t_symbols.bin');
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.setFont(f);
  u8g2.drawUTF8(0, 16, '★');       /* BLACK STAR */
  /* unifont star: at least one pixel set near (8, 8) relative to glyph */
  let set = 0;
  for (let y = 4; y < 16; y++) for (let x = 0; x < 16; x++) set += px(u8g2, x, y);
  assert.ok(set > 10, `star should have many pixels, got ${set}`);
});

test('transparent vs solid font mode', async () => {
  const f = await loadFont('u8g2_font_5x7_tf.bin');

  /* transparent: pixels under the glyph gaps are left untouched */
  const t = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  t.setFont(f);
  t.drawBox(10, 0, 8, 8);
  t.setFontMode(1);
  t.drawStr(10, 8, 'A');                /* A baseline 8 */
  assert.equal(px(t, 12, 4), 1);        /* box pixel inside a glyph gap survives */
  assert.equal(px(t, 10, 3), 1);        /* A left bar drawn on top */

  /* solid: background clears the same gap pixel */
  const s = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  s.setFont(f);
  s.drawBox(10, 0, 8, 8);
  s.setFontMode(0);
  s.drawStr(10, 8, 'A');
  assert.equal(px(s, 12, 4), 0);        /* cleared by solid background */
});

test('font direction rotates text', async () => {
  const f = await loadFont('u8g2_font_5x7_tf.bin');
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.setFont(f);
  u8g2.setFontDirection(1);             /* text flows downwards */
  u8g2.drawStr(20, 20, 'A');
  /* the rotated 'A' has pixels around (20..22, 20..26) */
  let cnt = 0;
  for (let y = 18; y <= 28; y++) for (let x = 18; x <= 26; x++) cnt += px(u8g2, x, y);
  assert.ok(cnt > 5, `rotated glyph should have pixels, got ${cnt}`);
});

test('X2 glyph scaling', async () => {
  const f = await loadFont('u8g2_font_5x7_tf.bin');
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.setFont(f);
  u8g2.drawGlyphX2(0, 20, 0x48);        /* 'H' at 2x, baseline 20 */
  assert.equal(px(u8g2, 0, 8), 1);      /* left bar, 2x tall */
  assert.equal(px(u8g2, 1, 8), 1);
  assert.equal(px(u8g2, 0, 9), 1);
});

test('isAllValidUTF8 / isGlyph', async () => {
  const f = await loadFont('u8g2_font_5x7_tf.bin');
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.setFont(f);
  assert.equal(u8g2.isAllValidUTF8('Hello'), 1);
  assert.equal(u8g2.isAllValidUTF8('H€'), 0); /* euro not in 5x7 */
  assert.equal(u8g2.isGlyph(0x48), 1);
});

/* =================================================================== */
/* Primitives                                                          */

test('drawBox / drawFrame / drawRBox / drawRFrame', async () => {
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.drawBox(0, 0, 10, 5);
  assert.equal(px(u8g2, 5, 2), 1);
  assert.equal(px(u8g2, 9, 4), 1);
  assert.equal(px(u8g2, 10, 0), 0);

  u8g2.drawFrame(20, 0, 10, 5);
  assert.equal(px(u8g2, 20, 0), 1);   /* border */
  assert.equal(px(u8g2, 25, 2), 0);   /* inside empty */
  assert.equal(px(u8g2, 29, 4), 1);

  u8g2.drawRBox(40, 0, 10, 8, 3);
  assert.equal(px(u8g2, 45, 4), 1);   /* filled center */
  assert.equal(px(u8g2, 40, 0), 0);   /* corner rounded */
  assert.equal(px(u8g2, 42, 0), 1);

  u8g2.drawRFrame(60, 0, 10, 8, 3);
  assert.equal(px(u8g2, 62, 0), 1);   /* top edge */
  assert.equal(px(u8g2, 65, 4), 0);   /* hollow center */
});

test('drawLine endpoints are inclusive', async () => {
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.drawLine(0, 0, 0, 5);
  for (let y = 0; y <= 5; y++) assert.equal(px(u8g2, 0, y), 1);
  assert.equal(px(u8g2, 0, 6), 0);

  u8g2.drawLine(10, 0, 20, 10); /* diagonal */
  assert.equal(px(u8g2, 10, 0), 1);
  assert.equal(px(u8g2, 20, 10), 1);
});

test('drawCircle / drawDisc / drawEllipse / drawFilledEllipse / drawArc', async () => {
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.drawCircle(20, 20, 8, U8G2_DRAW_ALL);
  assert.equal(px(u8g2, 20, 12), 1);   /* top */
  assert.equal(px(u8g2, 20, 20), 0);   /* centre hollow */
  assert.equal(px(u8g2, 12, 20), 1);   /* left */
  assert.equal(px(u8g2, 28, 20), 1);   /* right */

  u8g2.drawDisc(50, 20, 8, U8G2_DRAW_ALL);
  assert.equal(px(u8g2, 50, 20), 1);   /* centre filled */
  assert.equal(px(u8g2, 50, 13), 1);

  u8g2.drawEllipse(80, 20, 12, 6, U8G2_DRAW_ALL);
  assert.equal(px(u8g2, 80, 14), 1);   /* top */
  assert.equal(px(u8g2, 68, 20), 1);   /* left */
  assert.equal(px(u8g2, 80, 20), 0);

  u8g2.drawFilledEllipse(110, 20, 10, 8, U8G2_DRAW_ALL);
  assert.equal(px(u8g2, 110, 20), 1);  /* filled */
  assert.equal(px(u8g2, 110, 12), 1);

  u8g2.drawArc(20, 50, 8, 64, 128);    /* quadrant arc of radius 8 */
  assert.equal(px(u8g2, 20, 42), 1);   /* arc passes near top */
  assert.equal(px(u8g2, 20, 58), 0);   /* empty below */
  assert.equal(px(u8g2, 12, 48), 1);   /* arc passes near left */
});

test('drawTriangle (scanline fill)', async () => {
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.drawTriangle(10, 40, 30, 10, 50, 40);
  assert.equal(px(u8g2, 30, 25), 1);   /* centre */
  assert.equal(px(u8g2, 20, 39), 1);   /* base, last scanline */
  assert.equal(px(u8g2, 30, 40), 0);   /* scanline fill stops above the base row */
  assert.equal(px(u8g2, 30, 10), 0);   /* and starts below the apex row */
});

test('drawXBM + bitmap transparency', async () => {
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  const xbm = new Uint8Array([0x81, 0x42, 0x24, 0x18, 0x24, 0x42, 0x81]);
  u8g2.drawXBM(0, 0, 8, 7, xbm);
  assert.equal(px(u8g2, 0, 0), 1);
  assert.equal(px(u8g2, 7, 0), 1);
  assert.equal(px(u8g2, 0, 3), 0);
  assert.equal(px(u8g2, 3, 3), 1);
});

test('drawButtonUTF8 draws text + frame', async () => {
  const f = await loadFont('u8g2_font_5x7_tf.bin');
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.setFont(f);
  u8g2.drawButtonUTF8(30, 20, 0x02 | 0x40, 0, 3, 1, 'OK');
  assert.equal(px(u8g2, 20, 11), 1);   /* top border (2px, BW2) */
  assert.equal(px(u8g2, 20, 12), 1);
  assert.equal(px(u8g2, 30, 15), 1);   /* text pixel inside */
  assert.equal(px(u8g2, 20, 16), 1);   /* left border */
});

/* =================================================================== */
/* Color / clipping                                                    */

test('draw color 0 / 1 / XOR (2)', async () => {
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.setDrawColor(1);
  u8g2.drawBox(0, 0, 4, 4);
  assert.equal(px(u8g2, 2, 2), 1);
  u8g2.setDrawColor(0);
  u8g2.drawBox(2, 2, 4, 4);
  assert.equal(px(u8g2, 2, 2), 0);
  assert.equal(px(u8g2, 0, 0), 1);

  /* XOR toggles */
  u8g2.setDrawColor(2);
  u8g2.drawBox(0, 0, 4, 4);
  assert.equal(px(u8g2, 0, 0), 0);     /* was 1, toggled to 0 */
  assert.equal(px(u8g2, 3, 3), 1);     /* was 0, toggled to 1 */
});

test('setClipWindow restricts drawing', async () => {
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.setClipWindow(10, 10, 40, 30);
  u8g2.drawBox(0, 0, 64, 40);
  assert.equal(px(u8g2, 15, 15), 1);   /* inside clip */
  assert.equal(px(u8g2, 5, 5), 0);     /* outside clip */
  assert.equal(px(u8g2, 45, 35), 0);
  u8g2.setMaxClipWindow();
  u8g2.drawBox(0, 0, 3, 3);
  assert.equal(px(u8g2, 2, 2), 1);     /* drawing again after max */
});

/* =================================================================== */
/* Rotation                                                            */

test('display rotation remaps user coordinates', async () => {
  const u = new U8g2({ display: 'ssd1306_128x64_noname_f', rotation: U8G2_R1 });
  u.drawPixel(0, 0);
  assert.equal(px(u, 127, 0), 1);      /* R1: user(0,0) -> buffer(127,0) */
  assert.equal(px(u, 0, 0), 0);

  const u2 = new U8g2({ display: 'ssd1306_128x64_noname_f', rotation: U8G2_R2 });
  u2.drawPixel(0, 0);
  assert.equal(px(u2, 127, 63), 1);

  const u3 = new U8g2({ display: 'ssd1306_128x64_noname_f', rotation: U8G2_R3 });
  u3.drawPixel(0, 0);
  assert.equal(px(u3, 0, 63), 1);
});

test('setDisplayRotation swaps width/height', () => {
  const u = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  assert.equal(u.getDisplayWidth(), 128);
  assert.equal(u.getDisplayHeight(), 64);
  u.setDisplayRotation(U8G2_R1);
  assert.equal(u.getDisplayWidth(), 64);
  assert.equal(u.getDisplayHeight(), 128);
});

/* =================================================================== */
/* Page buffer / lifecycle                                             */

test('page mode accumulates pages into display memory', async () => {
  const f = await loadFont('u8g2_font_5x7_tf.bin');
  const p = new U8g2({ display: 'ssd1306_128x64_noname_f', pageRows: 2 });
  p.setFont(f);
  p.firstPage();
  p.drawBox(0, 0, 8, 8);
  p.nextPage();
  p.drawBox(0, 16, 8, 8);
  p.nextPage();
  p.drawBox(0, 32, 8, 8);
  p.nextPage();
  p.drawBox(0, 48, 8, 8);
  p.nextPage();                        /* returns 0, full loop done */
  assert.equal(px(p, 2, 4), 1);
  assert.equal(px(p, 2, 20), 1);
  assert.equal(px(p, 2, 36), 1);
  assert.equal(px(p, 2, 52), 1);
  assert.equal(px(p, 2, 12), 0);
});

test('buffer lifecycle', async () => {
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  assert.equal(u8g2.getBufferSize(), 1024);
  assert.equal(u8g2.getBufferTileWidth(), 16);
  assert.equal(u8g2.getBufferTileHeight(), 8);
  u8g2.drawPixel(0, 0);
  assert.equal(px(u8g2, 0, 0), 1);
  u8g2.clearBuffer();
  assert.equal(px(u8g2, 0, 0), 0);
});

test('clearDisplay + cursor helpers', async () => {
  const f = await loadFont('u8g2_font_5x7_tf.bin');
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.setFont(f);
  u8g2.clear();
  assert.equal(px(u8g2, 0, 0), 0);
  u8g2.setCursor(0, 10);
  u8g2.print('Hi');
  assert.ok(u8g2.getCursorX() > 0);
  assert.equal(px(u8g2, 0, 4), 1);     /* 'H' left bar, baseline 10 */
});

/* =================================================================== */
/* Displays                                                            */

test('all presets construct and report dimensions', () => {
  for (const name of listPresets()) {
    const u8g2 = new U8g2({ display: name });
    assert.ok(u8g2.getDisplayWidth() > 0);
    assert.ok(u8g2.getDisplayHeight() > 0);
    assert.equal(u8g2.getBufferSize(), u8g2.getBufferTileWidth() * u8g2.getBufferTileHeight() * 8);
  }
});

test('custom display geometry (250x122 e-paper like)', () => {
  const u8g2 = new U8g2({ width: 250, height: 122 });
  assert.equal(u8g2.getDisplayWidth(), 250);
  assert.equal(u8g2.getDisplayHeight(), 122);
  assert.equal(u8g2.getBufferTileWidth(), Math.ceil(250 / 8));
  assert.equal(u8g2.getBufferTileHeight(), Math.ceil(122 / 8));
  assert.equal(u8g2.getBufferSize(), Math.ceil(250 / 8) * Math.ceil(122 / 8) * 8);
  /* draw something near the far corner */
  u8g2.drawPixel(249, 121);
  assert.equal(px(u8g2, 249, 121), 1);
});

test('horizontal layout (ST7920) uses row bytes', () => {
  const u8g2 = new U8g2({ display: 'st7920_128x64' });
  u8g2.drawPixel(0, 0);
  assert.equal(px(u8g2, 0, 0), 1);
  assert.equal(u8g2.displayInfo.layout, 'horizontal');
  u8g2.drawBox(0, 8, 8, 8);            /* second byte row */
  assert.equal(px(u8g2, 4, 12), 1);
});

/* =================================================================== */
/* PBM export                                                          */

test('PBM export + parse roundtrip', async () => {
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.drawBox(3, 3, 4, 4);
  const pbm = toPBM(u8g2);
  const parsed = parsePBM(pbm);
  assert.equal(parsed.width, 128);
  assert.equal(parsed.height, 64);
  assert.equal(parsed.pixels[4 * 128 + 4], 1);
  assert.equal(parsed.pixels[0], 0);
});

/* =================================================================== */
/* register fonts by name                                              */

test('font registry + setFont(name)', async () => {
  const f = await loadFont('u8g2_font_5x7_tf.bin');
  U8g2Font.register('test_font', f);
  const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
  u8g2.setFont('test_font');
  u8g2.drawStr(0, 10, 'A');
  assert.equal(px(u8g2, 0, 5), 1);     /* A left bar, baseline 10 */
});
