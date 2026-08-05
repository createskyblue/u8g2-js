/**
 * u8g2.js
 *
 * The U8g2 class: a faithful JS port of the u8g2_t drawing engine.
 * Public API mirrors the Arduino U8g2lib wrapper (camelCase) and also
 * exposes snake_case aliases matching the C API, so code can move between
 * the simulator and real hardware with minimal edits.
 *
 * Core concepts (identical to the C library):
 *  - `tileBuf`:   the page buffer, byte-identical to the C tile buffer
 *  - `displayMemory`: full display resolution copy of what is "on screen".
 *    In `_f` (full buffer) mode tileBuf === displayMemory (one array).
 *  - drawing happens into `tileBuf` through `drawHVLine` -> `drawL90`
 *    (rotation) -> `ll_hvline` (byte layout).
 *  - `sendBuffer`/`nextPage` copy the buffer onto displayMemory and notify
 *    attached renderers.
 */

import { U8g2Font } from './font.js';
import { asciiNext, utf8Next, utf8Init } from './utf8.js';
import { llHVLineVerticalTopLsb, llHVLineHorizontalRightLsb } from './hvline.js';
import { installDrawFunctions, newPolygonState } from './draw.js';
import { resolveDisplay } from './setup.js';
import { createCanvasRenderer } from './renderer/canvas.js';

/* rotation constants (the C U8G2_R0..U8G2_R3 are pointers to callback
   structs; here they are just the rotation index 0..3) */
export const U8G2_R0 = 0;
export const U8G2_R1 = 1;
export const U8G2_R2 = 2;
export const U8G2_R3 = 3;

export const U8G2_FONT_HEIGHT_MODE_TEXT = 0;
export const U8G2_FONT_HEIGHT_MODE_XTEXT = 1;
export const U8G2_FONT_HEIGHT_MODE_ALL = 2;

function s8(v) { return v > 127 ? v - 256 : v; }

export class U8g2 {
  /**
   * @param {object} options
   *   display : preset name string (see setup.js), e.g. "ssd1306_128x64_noname_f"
   *   width/height/layout/xOffset : custom display definition
   *   rotation: 0..3
   *   pageRows: tile rows per page buffer (default: full display = _f mode)
   */
  constructor(options = {}) {
    this.renderers = [];
    this._cursorX = 0;
    this._cursorY = 0;
    this._cursorEnabled = false;
    this.powerSave = false;
    this.setup(options);
  }

  /* =============================================================== */
  /* Setup                                                            */

  setup(options = {}) {
    const cfg = resolveDisplay(options);
    this.displayInfo = {
      pixelWidth: cfg.pixelWidth,
      pixelHeight: cfg.pixelHeight,
      tileWidth: cfg.tileWidth,
      tileHeight: cfg.tileHeight,
      defaultXOffset: cfg.defaultXOffset || 0,
      flipXOffset: cfg.flipXOffset === undefined ? cfg.defaultXOffset || 0 : cfg.flipXOffset,
      layout: cfg.layout || 'vertical',
    };
    this.tileWidth = cfg.tileWidth;
    this.tileHeight = cfg.tileHeight;
    this.pixelBufWidth = cfg.tileWidth * 8;
    this.tileBufHeight = cfg.pageRows || cfg.tileHeight;

    this.tileBuf = new Uint8Array(this.tileWidth * this.tileBufHeight * 8);
    if (this.tileBufHeight === cfg.tileHeight) {
      /* full buffer mode: the buffer IS the display memory */
      this.displayMemory = this.tileBuf;
    } else {
      this.displayMemory = new Uint8Array(this.tileWidth * this.tileHeight * 8);
    }

    this.llHVLine = this.displayInfo.layout === 'horizontal'
      ? llHVLineHorizontalRightLsb
      : llHVLineVerticalTopLsb;

    this.rotation = (options.rotation === undefined ? 0 : options.rotation) & 3;
    this.flipMode = 0;

    this.font = null;
    this.fontInfo = null;
    this.fontDecode = {
      decode_ptr: 0, decode_bit_pos: 0,
      target_x: 0, target_y: 0,
      x: 0, y: 0, glyph_width: 0, glyph_height: 0,
      is_transparent: 0, fg_color: 1, bg_color: 0, dir: 0,
    };
    this.fontHeightMode = U8G2_FONT_HEIGHT_MODE_TEXT;
    this.fontRefAscent = 0;
    this.fontRefDescent = 0;
    this.glyphXOffset = 0;

    this.bitmapTransparency = 0;
    this.drawColor = 1;
    this.isAutoPageClear = 1;

    this.tileCurrRow = 0;
    this.pixelCurrRow = 0;
    this.pixelBufHeight = 0;
    this.bufY0 = 0;
    this.bufY1 = 0;
    this.width = cfg.pixelWidth;
    this.height = cfg.pixelHeight;
    this.userX0 = 0; this.userX1 = 0; this.userY0 = 0; this.userY1 = 0;
    this.clipX0 = 0; this.clipX1 = 0; this.clipY0 = 0; this.clipY1 = 0;
    this.isPageClipWindowIntersection = 1;

    this.polygon = newPolygonState();

    this.updateDimension();
    this.setMaxClipWindow();
    this.setFontPosBaseline();
    this.fontDecode.dir = 0;
  }

  /* ---------------- setup helpers -------------------------------- */

  updateDimension() {
    const di = this.displayInfo;
    this.pixelBufHeight = this.tileBufHeight * 8;
    this.pixelBufWidth = this.tileWidth * 8;
    this.pixelCurrRow = this.tileCurrRow * 8;

    let t = this.tileBufHeight;
    if (t + this.tileCurrRow > di.tileHeight) t = di.tileHeight - this.tileCurrRow;
    t *= 8;
    this.bufY0 = this.pixelCurrRow;
    this.bufY1 = this.bufY0 + t;

    this.width = di.pixelWidth;
    this.height = di.pixelHeight;
    if (this.rotation === 1 || this.rotation === 3) {
      const tmp = this.width;
      this.width = di.pixelHeight;
      this.height = tmp;
    }
  }

  updatePageWin() {
    const w = this.width;
    const h = this.height;
    if (this.rotation === 0 || this.rotation === 2) {
      this.userX0 = 0;
      this.userX1 = w;
      if (this.rotation === 0) {
        this.userY0 = this.bufY0;
        this.userY1 = this.bufY1;
      } else {
        this.userY0 = h >= this.bufY1 ? h - this.bufY1 : 0;
        this.userY1 = h - this.bufY0;
      }
    } else if (this.rotation === 1) {
      this.userX0 = this.bufY0;
      this.userX1 = this.bufY1;
      this.userY0 = 0;
      this.userY1 = h;
    } else {
      this.userX0 = w >= this.bufY1 ? w - this.bufY1 : 0;
      this.userX1 = w - this.bufY0;
      this.userY0 = 0;
      this.userY1 = h;
    }
    this.applyClipWindow();
  }

  applyClipWindow() {
    if (this.isIntersection(this.clipX0, this.clipY0, this.clipX1, this.clipY1) === 0) {
      this.isPageClipWindowIntersection = 0;
    } else {
      this.isPageClipWindowIntersection = 1;
      if (this.userX0 < this.clipX0) this.userX0 = this.clipX0;
      if (this.userX1 > this.clipX1) this.userX1 = this.clipX1;
      if (this.userY0 < this.clipY0) this.userY0 = this.clipY0;
      if (this.userY1 > this.clipY1) this.userY1 = this.clipY1;
    }
  }

  setMaxClipWindow() {
    this.clipX0 = 0;
    this.clipY0 = 0;
    this.clipX1 = 0xffffffff;
    this.clipY1 = 0xffffffff;
    this.updatePageWin();
  }

  setClipWindow(x0, y0, x1, y1) {
    this.clipX0 = x0;
    this.clipY0 = y0;
    this.clipX1 = x1;
    this.clipY1 = y1;
    this.updatePageWin();
  }

  getClipWindow() {
    return { x0: this.clipX0, y0: this.clipY0, x1: this.clipX1, y1: this.clipY1 };
  }

  setDisplayRotation(rot) {
    this.rotation = rot & 3;
    this.updateDimension();
    this.updatePageWin();
    this.render();
  }

  setFlipMode(mode) {
    this.flipMode = mode ? 1 : 0;
    this.render();
  }

  /* =============================================================== */
  /* Low level pixel pipeline (faithful to u8g2_hvline.c)             */

  clipIntersection2(a, len, c, d) {
    let b = a + len;
    if (a > b) {
      if (a < d) b = d - 1;
      else a = c;
    }
    if (a >= d) return { ok: 0 };
    if (b <= c) return { ok: 0 };
    if (a < c) a = c;
    if (b > d) b = d;
    b -= a;
    return { ok: 1, a, len: b };
  }

  drawHVLine(x, y, len, dir) {
    if (this.isPageClipWindowIntersection !== 0) {
      if (len !== 0) {
        if (len > 1) {
          if (dir === 2) { x -= len; x++; }
          else if (dir === 3) { y -= len; y++; }
        }
        dir &= 1;
        if (dir === 0) {
          if (y < this.userY0) return;
          if (y >= this.userY1) return;
          const r = this.clipIntersection2(x, len, this.userX0, this.userX1);
          if (!r.ok) return;
          x = r.a; len = r.len;
        } else {
          if (x < this.userX0) return;
          if (x >= this.userX1) return;
          const r = this.clipIntersection2(y, len, this.userY0, this.userY1);
          if (!r.ok) return;
          y = r.a; len = r.len;
        }
        this.drawL90(x, y, len, dir);
      }
    }
  }

  drawL90(x, y, len, dir) {
    switch (this.rotation) {
      case 1: this.drawL90R1(x, y, len, dir); break;
      case 2: this.drawL90R2(x, y, len, dir); break;
      case 3: this.drawL90R3(x, y, len, dir); break;
      default: this.drawHVLine2Dir(x, y, len, dir); break;
    }
  }

  drawHVLine2Dir(x, y, len, dir) {
    y -= this.pixelCurrRow;
    this.llHVLine(this, x, y, len, dir);
  }

  drawL90R1(x, y, len, dir) {
    const yy = x;
    let xx = this.height - y - 1;
    dir++;
    if (dir === 2) { xx -= len; xx++; dir = 0; }
    this.drawHVLine2Dir(xx, yy, len, dir);
  }

  drawL90R2(x, y, len, dir) {
    let yy = this.height - y;
    let xx = this.width - x;
    if (dir === 0) { yy--; xx -= len; }
    else if (dir === 1) { xx--; yy -= len; }
    this.drawHVLine2Dir(xx, yy, len, dir);
  }

  drawL90R3(x, y, len, dir) {
    const xx = y;
    let yy = this.width - x;
    if (dir === 0) { yy--; yy -= len; yy++; dir = 1; }
    else { yy--; dir = 0; }
    this.drawHVLine2Dir(xx, yy, len, dir);
  }

  drawPixel(x, y) {
    this.drawHVLine(x, y, 1, 0);
  }

  drawHLine(x, y, len) { this.drawHVLine(x, y, len, 0); }
  drawVLine(x, y, len) { this.drawHVLine(x, y, len, 1); }

  setDrawColor(color) {
    this.drawColor = color;
    if (color >= 3) this.drawColor = 1;
  }

  getDrawColor() { return this.drawColor; }

  isIntersectionDecisionTree(a0, a1, v0, v1) {
    if (v0 <= a1) {
      if (v1 >= a0) return 1;
      if (v0 > v1) return 1;
      return 0;
    }
    if (v1 >= a0) {
      if (v0 > v1) return 1;
      return 0;
    }
    return 0;
  }

  isIntersection(x0, y0, x1, y1) {
    if (this.isIntersectionDecisionTree(this.userY0, this.userY1, y0, y1) === 0) return 0;
    return this.isIntersectionDecisionTree(this.userX0, this.userX1, x0, x1);
  }

  /* =============================================================== */
  /* Page buffer / lifecycle                                          */

  clearBuffer() {
    this.tileBuf.fill(0);
  }

  getBufferSize() { return this.tileBuf.length; }
  getBufferPtr() { return this.tileBuf; }
  getBufferTileWidth() { return this.tileWidth; }
  getBufferTileHeight() { return this.tileBufHeight; }
  getBufferCurrTileRow() { return this.tileCurrRow; }
  getPageCurrTileRow() { return this.tileCurrRow; }

  setBufferCurrTileRow(row) {
    this.tileCurrRow = row;
    this.updateDimension();
    this.updatePageWin();
  }

  sendTileRow(srcRow, destRow) {
    if (this.tileBuf === this.displayMemory) return;
    const rowBytes = this.tileWidth * 8;
    const dstOff = destRow * rowBytes;
    this.displayMemory.set(this.tileBuf.subarray(srcRow * rowBytes, (srcRow + 1) * rowBytes), dstOff);
  }

  sendBufferInternal() {
    let srcRow = 0;
    const srcMax = this.tileBufHeight;
    let destRow = this.tileCurrRow;
    const destMax = this.tileHeight;
    do {
      this.sendTileRow(srcRow, destRow);
      srcRow++;
      destRow++;
    } while (srcRow < srcMax && destRow < destMax);
  }

  sendBuffer() {
    this.sendBufferInternal();
    this.render();
  }

  updateDisplay() {
    this.sendBufferInternal();
    this.render();
  }

  updateDisplayArea(tx, ty, tw, th) {
    if (this.tileBuf !== this.displayMemory) return; /* page mode: no-op like C */
    /* display memory is the buffer; nothing else to do for the simulator */
    this.render();
  }

  refreshDisplay() { this.sendBuffer(); }

  firstPage() {
    if (this.isAutoPageClear) this.clearBuffer();
    this.setBufferCurrTileRow(0);
  }

  nextPage() {
    this.sendBufferInternal();
    let row = this.tileCurrRow + this.tileBufHeight;
    if (row >= this.tileHeight) {
      this.render();
      return 0;
    }
    if (this.isAutoPageClear) this.clearBuffer();
    this.setBufferCurrTileRow(row);
    this.render();
    return 1;
  }

  setAutoPageClear(mode) { this.isAutoPageClear = mode; }

  clearDisplay() {
    this.firstPage();
    do { } while (this.nextPage());
    this.setBufferCurrTileRow(0);
  }

  /* Arduino-style lifecycle helpers */
  begin() { this.setPowerSave(0); return true; }
  initDisplay() { this.setPowerSave(0); }
  initInterface() {}
  setPowerSave(isEnable) { this.powerSave = !!isEnable; this.render(); }
  setContrast(value) { this.contrast = value; this.render(); }
  noDisplay() { this.setPowerSave(1); }
  display() { this.setPowerSave(0); }
  sleepOn() { this.setPowerSave(1); }
  sleepOff() { this.setPowerSave(0); }

  /* cursor based helpers (Print-ish) */
  home() { this._cursorX = 0; this._cursorY = 0; this._cursorEnabled = true; }
  clear() { this.clearDisplay(); this.home(); }
  setCursor(x, y) { this._cursorX = x; this._cursorY = y; this._cursorEnabled = true; }
  getCursorX() { return this._cursorX; }
  getCursorY() { return this._cursorY; }
  print(s) {
    const str = String(s);
    this.drawUTF8(this._cursorX, this._cursorY, str);
    if (this._cursorEnabled) this._cursorX += this.getUTF8Width(str);
  }
  println(s) {
    this.print(s);
    if (this._cursorEnabled) {
      this._cursorX = 0;
      this._cursorY += this.getMaxCharHeight();
    }
  }
  setColorIndex(c) { this.setDrawColor(c); }
  getColorIndex() { return this.getDrawColor(); }

  /* dimensions */
  getDisplayWidth() { return this.width; }
  getDisplayHeight() { return this.height; }
  getWidth() { return this.width; }
  getHeight() { return this.height; }
  getCols() { return this.width / 8; }
  getRows() { return this.tileHeight; }

  /* =============================================================== */
  /* Fonts and text (faithful to u8g2_font.c)                         */

  setFont(font) {
    const f = U8g2Font.resolve(font);
    if (!f) throw new Error('u8g2.setFont: cannot resolve font');
    if (this.font !== f) {
      this.font = f;
      this.fontInfo = f.info;
      this.updateRefHeight();
    }
  }

  setFontMode(isTransparent) { this.fontDecode.is_transparent = isTransparent; }
  setFontDirection(dir) { this.fontDecode.dir = dir & 3; }

  setFontRefHeightText() { this.fontHeightMode = U8G2_FONT_HEIGHT_MODE_TEXT; this.updateRefHeight(); }
  setFontRefHeightExtendedText() { this.fontHeightMode = U8G2_FONT_HEIGHT_MODE_XTEXT; this.updateRefHeight(); }
  setFontRefHeightAll() { this.fontHeightMode = U8G2_FONT_HEIGHT_MODE_ALL; this.updateRefHeight(); }

  updateRefHeight() {
    if (this.font === null) return;
    const fi = this.fontInfo;
    this.fontRefAscent = fi.ascent_A;
    this.fontRefDescent = fi.descent_g;
    if (this.fontHeightMode === U8G2_FONT_HEIGHT_MODE_TEXT) {
      /* nothing */
    } else if (this.fontHeightMode === U8G2_FONT_HEIGHT_MODE_XTEXT) {
      if (this.fontRefAscent < fi.ascent_para) this.fontRefAscent = fi.ascent_para;
      if (this.fontRefDescent > fi.descent_para) this.fontRefDescent = fi.descent_para;
    } else {
      if (this.fontRefAscent < fi.max_char_height + fi.y_offset) this.fontRefAscent = fi.max_char_height + fi.y_offset;
      if (this.fontRefDescent > fi.y_offset) this.fontRefDescent = fi.y_offset;
    }
  }

  setFontPosBaseline() { this._fontCalcVref = this.fontCalcVrefBaseline; }
  setFontPosBottom() { this._fontCalcVref = this.fontCalcVrefBottom; }
  setFontPosTop() { this._fontCalcVref = this.fontCalcVrefTop; }
  setFontPosCenter() { this._fontCalcVref = this.fontCalcVrefCenter; }

  fontCalcVref() { return this._fontCalcVref.call(this); }
  fontCalcVrefBaseline() { return 0; }
  fontCalcVrefBottom() { return this.fontRefDescent; }
  fontCalcVrefTop() { return this.fontRefAscent + 1; }
  fontCalcVrefCenter() { return Math.trunc((this.fontRefAscent - this.fontRefDescent) / 2) + this.fontRefDescent; }

  getAscent() { return this.fontRefAscent; }
  getDescent() { return this.fontRefDescent; }
  getFontAscent() { return this.fontRefAscent; }
  getFontDescent() { return this.fontRefDescent; }
  getMaxCharHeight() { return this.fontInfo ? this.fontInfo.max_char_height : 0; }
  getMaxCharWidth() { return this.fontInfo ? this.fontInfo.max_char_width : 0; }
  getFontBBXWidth() { return this.fontInfo ? this.fontInfo.max_char_width : 0; }
  getFontBBXHeight() { return this.fontInfo ? this.fontInfo.max_char_height : 0; }
  getFontBBXOffX() { return this.fontInfo ? this.fontInfo.x_offset : 0; }
  getFontBBXOffY() { return this.fontInfo ? this.fontInfo.y_offset : 0; }
  getFontCapitalAHeight() { return this.fontInfo ? this.fontInfo.ascent_A : 0; }

  /* ---- font bitstream decode ------------------------------------ */

  fontGetGlyphData(encoding) {
    return this.font.getGlyphData(encoding);
  }

  fontGetUnsignedBits(cnt) {
    const dec = this.fontDecode;
    const data = this.font.data;
    let val = data[dec.decode_ptr];
    val >>= dec.decode_bit_pos;
    let bitPosPlusCnt = dec.decode_bit_pos + cnt;
    if (bitPosPlusCnt >= 8) {
      const s = 8 - dec.decode_bit_pos;
      dec.decode_ptr++;
      val |= data[dec.decode_ptr] << s;
      bitPosPlusCnt -= 8;
    }
    val &= (1 << cnt) - 1;
    dec.decode_bit_pos = bitPosPlusCnt;
    return val;
  }

  fontGetSignedBits(cnt) {
    const v = this.fontGetUnsignedBits(cnt);
    let d = 1;
    cnt--;
    d <<= cnt;
    return v - d;
  }

  fontSetupDecode(glyphData) {
    const dec = this.fontDecode;
    dec.decode_ptr = glyphData;
    dec.decode_bit_pos = 0;
    dec.glyph_width = this.fontGetUnsignedBits(this.fontInfo.bits_per_char_width);
    dec.glyph_height = this.fontGetUnsignedBits(this.fontInfo.bits_per_char_height);
    dec.fg_color = this.drawColor;
    dec.bg_color = dec.fg_color === 0 ? 1 : 0;
  }

  fontAddVectorX(dx, x, y, dir) {
    switch (dir) {
      case 0: return dx + x;
      case 1: return dx - y;
      case 2: return dx - x;
      default: return dx + y;
    }
  }

  fontAddVectorY(dy, x, y, dir) {
    switch (dir) {
      case 0: return dy + y;
      case 1: return dy + x;
      case 2: return dy - y;
      default: return dy - x;
    }
  }

  fontDecodeLen(len, isForeground) {
    let cnt = len;
    const dec = this.fontDecode;
    let lx = dec.x;
    let ly = dec.y;

    for (;;) {
      const rem = dec.glyph_width - lx;
      let current = rem;
      if (cnt < rem) current = cnt;

      let x = this.fontAddVectorX(dec.target_x, lx, ly, dec.dir);
      let y = this.fontAddVectorY(dec.target_y, lx, ly, dec.dir);

      if (isForeground) {
        this.drawColor = dec.fg_color;
        this.drawHVLine(x, y, current, dec.dir);
      } else if (dec.is_transparent === 0) {
        this.drawColor = dec.bg_color;
        this.drawHVLine(x, y, current, dec.dir);
      }

      if (cnt < rem) break;
      cnt -= rem;
      lx = 0;
      ly++;
    }
    lx += cnt;
    dec.x = lx;
    dec.y = ly;
  }

  fontDecodeGlyph(glyphData) {
    const dec = this.fontDecode;
    this.fontSetupDecode(glyphData);
    const h = dec.glyph_height;

    const x = this.fontGetSignedBits(this.fontInfo.bits_per_char_x);
    const y = this.fontGetSignedBits(this.fontInfo.bits_per_char_y);
    const d = this.fontGetSignedBits(this.fontInfo.bits_per_delta_x);

    if (dec.glyph_width > 0) {
      dec.target_x = this.fontAddVectorX(dec.target_x, x, -(h + y), dec.dir);
      dec.target_y = this.fontAddVectorY(dec.target_y, x, -(h + y), dec.dir);

      dec.x = 0;
      dec.y = 0;

      for (;;) {
        const a = this.fontGetUnsignedBits(this.fontInfo.bits_per_0);
        const b = this.fontGetUnsignedBits(this.fontInfo.bits_per_1);
        do {
          this.fontDecodeLen(a, 0);
          this.fontDecodeLen(b, 1);
        } while (this.fontGetUnsignedBits(1) !== 0);

        if (dec.y >= h) break;
      }

      this.drawColor = dec.fg_color;
    }
    return d;
  }

  font2xDecodeLen(len, isForeground) {
    let cnt = len;
    const dec = this.fontDecode;
    let lx = dec.x;
    let ly = dec.y;

    for (;;) {
      const rem = dec.glyph_width - lx;
      let current = rem;
      if (cnt < rem) current = cnt;

      const x = dec.target_x + lx * 2;
      const y = dec.target_y + ly * 2;

      if (isForeground) {
        this.drawColor = dec.fg_color;
        this.drawHVLine(x, y, current * 2, 0);
        this.drawHVLine(x, y + 1, current * 2, 0);
      } else if (dec.is_transparent === 0) {
        this.drawColor = dec.bg_color;
        this.drawHVLine(x, y, current * 2, 0);
        this.drawHVLine(x, y + 1, current * 2, 0);
      }

      if (cnt < rem) break;
      cnt -= rem;
      lx = 0;
      ly++;
    }
    lx += cnt;
    dec.x = lx;
    dec.y = ly;
  }

  font2xDecodeGlyph(glyphData) {
    const dec = this.fontDecode;
    this.fontSetupDecode(glyphData);
    const h = dec.glyph_height;

    const x = this.fontGetSignedBits(this.fontInfo.bits_per_char_x);
    const y = this.fontGetSignedBits(this.fontInfo.bits_per_char_y);
    const d = this.fontGetSignedBits(this.fontInfo.bits_per_delta_x);

    if (dec.glyph_width > 0) {
      dec.target_x += x;
      dec.target_y -= 2 * h + y;
      dec.x = 0;
      dec.y = 0;

      for (;;) {
        const a = this.fontGetUnsignedBits(this.fontInfo.bits_per_0);
        const b = this.fontGetUnsignedBits(this.fontInfo.bits_per_1);
        do {
          this.font2xDecodeLen(a, 0);
          this.font2xDecodeLen(b, 1);
        } while (this.fontGetUnsignedBits(1) !== 0);

        if (dec.y >= h) break;
      }
      this.drawColor = dec.fg_color;
    }
    return d * 2;
  }

  /* ---- glyph / string drawing ----------------------------------- */

  drawGlyph(x, y, encoding) {
    y += this.fontCalcVref();
    this.fontDecode.target_x = x;
    this.fontDecode.target_y = y;
    const glyphData = this.fontGetGlyphData(encoding);
    if (glyphData !== -1) return this.fontDecodeGlyph(glyphData);
    return 0;
  }

  drawGlyphX2(x, y, encoding) {
    y += 2 * this.fontCalcVref();
    this.fontDecode.target_x = x;
    this.fontDecode.target_y = y;
    const glyphData = this.fontGetGlyphData(encoding);
    if (glyphData !== -1) return this.font2xDecodeGlyph(glyphData);
    return 0;
  }

  _drawString(x, y, str, nextCb, isX2) {
    const bytes = new TextEncoder().encode(str);
    const state = utf8Init();
    let sum = 0;
    const dir = this.fontDecode.dir;

    for (let i = 0; i < bytes.length; i++) {
      const e = nextCb(state, bytes[i]);
      if (e === 0x0ffff) break;
      if (e !== 0x0fffe) {
        const delta = isX2 ? this.drawGlyphX2(x, y, e) : this.drawGlyph(x, y, e);
        switch (dir) {
          case 0: x += delta; break;
          case 1: y += delta; break;
          case 2: x -= delta; break;
          default: y -= delta; break;
        }
        sum += delta;
      }
    }
    return sum;
  }

  drawStr(x, y, str) { return this._drawString(x, y, str, asciiNext, false); }
  drawStrX2(x, y, str) { return this._drawString(x, y, str, asciiNext, true); }
  drawUTF8(x, y, str) { return this._drawString(x, y, str, utf8Next, false); }
  drawUTF8X2(x, y, str) { return this._drawString(x, y, str, utf8Next, true); }

  /* kerning (u8g2_kerning.c) */
  getKerning(kerning, e1, e2) {
    if (!kerning) return 0;
    const cnt = kerning.first_table_cnt - 1;
    let i1;
    for (i1 = 0; i1 < cnt; i1++) {
      if (kerning.first_encoding_table[i1] === e1) break;
    }
    if (i1 >= cnt) return 0;
    const end = kerning.index_to_second_table[i1 + 1];
    let i2;
    for (i2 = kerning.index_to_second_table[i1]; i2 < end; i2++) {
      if (kerning.second_encoding_table[i2] === e2) break;
    }
    if (i2 >= end) return 0;
    return kerning.kerning_values[i2];
  }

  getKerningByTable(kt, e1, e2) {
    if (!kt) return 0;
    let i = 0;
    for (;;) {
      if (kt[i] === 0x0ffff) break;
      if (kt[i] === e1) {
        i++;
        while (kt[i] !== 0x0ffff && kt[i] !== e2) i++;
        if (kt[i] === e2) return kt[i + 1];
        return 0;
      }
      i += 2;
    }
    return 0;
  }

  drawExtendedUTF8(x, y, toLeft, kerning, str) {
    const bytes = new TextEncoder().encode(str);
    const state = utf8Init();
    let e_prev = 0x0ffff;
    let sum = 0;

    for (let i = 0; i < bytes.length; i++) {
      const e = utf8Next(state, bytes[i]);
      if (e === 0x0ffff) break;
      if (e !== 0x0fffe) {
        let delta = this.getGlyphWidth(e);
        let k;
        if (toLeft) {
          k = this.getKerning(kerning, e, e_prev);
          delta -= k;
          x -= delta;
        } else {
          k = this.getKerning(kerning, e_prev, e);
          delta -= k;
        }
        e_prev = e;

        this.drawGlyph(x, y, e);
        if (!toLeft) {
          x += delta;
          x -= k;
        }
        sum += delta;
      }
    }
    return sum;
  }

  drawExtUTF8(x, y, toLeft, kerningTable, str) {
    const bytes = new TextEncoder().encode(str);
    const state = utf8Init();
    let e_prev = 0x0ffff;
    let sum = 0;

    for (let i = 0; i < bytes.length; i++) {
      const e = utf8Next(state, bytes[i]);
      if (e === 0x0ffff) break;
      if (e !== 0x0fffe) {
        let delta = this.getGlyphWidth(e);
        let k;
        if (toLeft) {
          k = this.getKerningByTable(kerningTable, e, e_prev);
          delta -= k;
          x -= delta;
        } else {
          k = this.getKerningByTable(kerningTable, e_prev, e);
          delta -= k;
        }
        e_prev = e;

        if (!toLeft) x += delta;
        this.drawGlyph(x, y, e);
        sum += delta;
      }
    }
    return sum;
  }

  drawHB(x, y, data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    let i = 0;
    for (;;) {
      let encoding = bytes[i++];
      encoding = (encoding << 8) | bytes[i++];
      if (encoding === 0) break;
      x += (bytes[i++] << 24) >> 24; /* int8 */
      y += (bytes[i++] << 24) >> 24;
      this.drawGlyph(x, y, encoding);
    }
  }

  /* ---- width / metrics ------------------------------------------- */

  getGlyphWidth(encoding) {
    const glyphData = this.fontGetGlyphData(encoding);
    if (glyphData === -1) return 0;
    this.fontSetupDecode(glyphData);
    this.glyphXOffset = this.fontGetSignedBits(this.fontInfo.bits_per_char_x);
    this.fontGetSignedBits(this.fontInfo.bits_per_char_y);
    return this.fontGetSignedBits(this.fontInfo.bits_per_delta_x);
  }

  getXOffsetGlyph(encoding) {
    this.getGlyphWidth(encoding);
    return this.glyphXOffset;
  }

  getXOffsetUTF8(utf8Str) {
    const bytes = new TextEncoder().encode(utf8Str);
    const state = utf8Init();
    for (let i = 0; i < bytes.length; i++) {
      const e = utf8Next(state, bytes[i]);
      if (e === 0x0ffff) return 0;
      if (e !== 0x0fffe) return this.getXOffsetGlyph(e);
    }
    return 0;
  }

  getStrX(s) {
    const bytes = new TextEncoder().encode(s);
    const info = this.font.getGlyphProps(bytes[0]);
    return info ? info.ox : 0;
  }

  _stringWidth(str, nextCb) {
    const bytes = new TextEncoder().encode(str);
    const state = utf8Init();
    const dec = this.fontDecode;
    dec.glyph_width = 0;
    let w = 0;
    let dx = 0;
    for (let i = 0; i < bytes.length; i++) {
      const e = nextCb(state, bytes[i]);
      if (e === 0x0ffff) break;
      if (e !== 0x0fffe) {
        dx = this.getGlyphWidth(e); /* side effect: sets glyphXOffset */
        w += dx;
      }
    }
    if (dec.glyph_width !== 0) {
      w -= dx;
      w += dec.glyph_width;
      w += this.glyphXOffset;
    }
    return w;
  }

  getStrWidth(s) { return this._stringWidth(s, asciiNext); }
  getUTF8Width(str) { return this._stringWidth(str, utf8Next); }

  isGlyph(encoding) {
    return this.font.getGlyphData(encoding) !== -1 ? 1 : 0;
  }

  isAllValidUTF8(str) {
    const bytes = new TextEncoder().encode(str);
    const state = utf8Init();
    for (let i = 0; i < bytes.length; i++) {
      const e = utf8Next(state, bytes[i]);
      if (e === 0x0ffff) break;
      if (e !== 0x0fffe) {
        if (this.fontGetGlyphData(e) === -1) return 0;
      }
    }
    return 1;
  }

  getFontSize() { return this.font.getFontSize(); }

  /* =============================================================== */
  /* Renderers                                                        */

  attachRenderer(renderer) {
    this.renderers.push(renderer);
    renderer.attach?.(this);
    renderer.update?.(this);
    return renderer;
  }

  render() {
    for (const r of this.renderers) r.update?.(this);
  }

  /**
   * Convenience: attach an HTML canvas as the display.
   * `canvas` must already be sized by the caller (or use scale).
   * Returns the renderer (see renderer/canvas.js).
   */
  attachCanvas(canvas, options = {}) {
    return this.attachRenderer(createCanvasRenderer(canvas, options));
  }
}

/* snake_case aliases for the C API */
const snakeAliases = {
  setDrawColor: 'setDrawColor', clearBuffer: 'clearBuffer', sendBuffer: 'sendBuffer',
  drawPixel: 'drawPixel', drawLine: 'drawLine', drawHLine: 'drawHLine', drawVLine: 'drawVLine',
  drawBox: 'drawBox', drawFrame: 'drawFrame', drawRBox: 'drawRBox', drawRFrame: 'drawRFrame',
  drawCircle: 'drawCircle', drawDisc: 'drawDisc', drawEllipse: 'drawEllipse',
  drawFilledEllipse: 'drawFilledEllipse', drawArc: 'drawArc', drawTriangle: 'drawTriangle',
  drawStr: 'drawStr', drawUTF8: 'drawUTF8', drawGlyph: 'drawGlyph', drawGlyphX2: 'drawGlyphX2',
  getStrWidth: 'getStrWidth', getUTF8Width: 'getUTF8Width', getGlyphWidth: 'getGlyphWidth',
  setFont: 'setFont', setFontMode: 'setFontMode', setFontDirection: 'setFontDirection',
  setFontPosBaseline: 'setFontPosBaseline', setFontPosBottom: 'setFontPosBottom',
  setFontPosTop: 'setFontPosTop', setFontPosCenter: 'setFontPosCenter',
  setFontRefHeightText: 'setFontRefHeightText', setFontRefHeightExtendedText: 'setFontRefHeightExtendedText',
  setFontRefHeightAll: 'setFontRefHeightAll',
  setClipWindow: 'setClipWindow', setMaxClipWindow: 'setMaxClipWindow',
  isIntersection: 'isIntersection', getAscent: 'getAscent', getDescent: 'getDescent',
  getMaxCharHeight: 'getMaxCharHeight', getMaxCharWidth: 'getMaxCharWidth',
  getDisplayWidth: 'getDisplayWidth', getDisplayHeight: 'getDisplayHeight',
  firstPage: 'firstPage', nextPage: 'nextPage', clearDisplay: 'clearDisplay',
  isGlyph: 'isGlyph', isAllValidUTF8: 'isAllValidUTF8',
  getXOffsetGlyph: 'getXOffsetGlyph', getXOffsetUTF8: 'getXOffsetUTF8',
  setBitmapMode: 'setBitmapMode', drawXBM: 'drawXBM', drawXBMP: 'drawXBMP',
  clearPolygonXY: 'clearPolygonXY', addPolygonXY: 'addPolygonXY', drawPolygon: 'drawPolygon',
  drawButtonFrame: 'drawButtonFrame', drawButtonUTF8: 'drawButtonUTF8',
  drawExtendedUTF8: 'drawExtendedUTF8', drawExtUTF8: 'drawExtUTF8', drawHB: 'drawHB',
  getKerning: 'getKerning', getKerningByTable: 'getKerningByTable',
  updateDisplay: 'updateDisplay', updateDisplayArea: 'updateDisplayArea',
  setDisplayRotation: 'setDisplayRotation', setFlipMode: 'setFlipMode',
  setAutoPageClear: 'setAutoPageClear', setBufferCurrTileRow: 'setBufferCurrTileRow',
  getBufferPtr: 'getBufferPtr', getBufferSize: 'getBufferSize',
  getBufferTileHeight: 'getBufferTileHeight', getBufferTileWidth: 'getBufferTileWidth',
  getBufferCurrTileRow: 'getBufferCurrTileRow',
  getFontBBXWidth: 'getFontBBXWidth', getFontBBXHeight: 'getFontBBXHeight',
  getFontBBXOffX: 'getFontBBXOffX', getFontBBXOffY: 'getFontBBXOffY',
  getFontCapitalAHeight: 'getFontCapitalAHeight',
  setContrast: 'setContrast', setPowerSave: 'setPowerSave',
};

/* the C API writes u8g2_SetDrawColor / u8g2_DrawBox ... ; we register
   both u8g2_setDrawColor and u8g2_SetDrawColor styles */
for (const [camel, method] of Object.entries(snakeAliases)) {
  const snake = camel.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
  const CStyle = 'u8g2_' + snake;
  const CStyleCapital = 'u8g2_' + camel[0].toUpperCase() + camel.slice(1);
  U8g2.prototype[snake] = function (...args) { return this[method](...args); };
  U8g2.prototype[CStyle] = function (...args) { return this[method](...args); };
  U8g2.prototype[CStyleCapital] = function (...args) { return this[method](...args); };
}

installDrawFunctions(U8g2);
