/**
 * font.js
 *
 * U8g2Font: wraps one U8G2 font as a plain Uint8Array (byte-identical to the
 * "new font format" in u8g2_font.c).  The library never bundles fonts: a font
 * is just an array, load it however you like at runtime.
 *
 *   const f1 = U8g2Font.fromArray(new Uint8Array([...]));
 *   const f2 = U8g2Font.fromBase64("AP//AA...");          // converter output
 *   const f3 = U8g2Font.fromC("\\277\\0\\2\\2...");        // paste the .c string
 *   const f4 = await U8g2Font.load("/fonts/u8g2_font_5x7_tf.bin");  // fetch
 *
 *   U8g2Font.register("u8g2_font_5x7_tf", f2);            // then setFont("u8g2_font_5x7_tf")
 *
 * Header layout (23 bytes, see u8g2_font.c):
 *   0  glyph_cnt   1  bbx_mode        2  bits_per_0      3  bits_per_1
 *   4  bits/char_w 5  bits/char_h     6  bits/char_x     7  bits/char_y
 *   8  bits/delta_x 9  max_char_width 10 max_char_height 11 x_offset
 *   12 y_offset    13 ascent_A        14 descent_g       15 ascent_para
 *   16 descent_para 17..18 start_pos_upper_A (BE)
 *   19..20 start_pos_lower_a (BE)     21..22 start_pos_unicode (BE)
 */

const FONT_DATA_STRUCT_SIZE = 23;

/* ---------------------------------------------------------------- */
/* base64 helpers (browser + node)                                  */

function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64ToBytes(b64) {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  /* node without global atob */
  const buf = Buffer.from(b64, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/* ---------------------------------------------------------------- */
/* parse a C string literal (octal / hex / escaped / literal bytes) */

export function parseCStringBytes(str) {
  const out = [];
  let i = 0;
  while (i < str.length) {
    const c = str.charCodeAt(i);
    if (c === 0x5c /* '\\' */) {
      const n = str.charCodeAt(i + 1);
      if (n === 0x78 /* 'x' hex escape */) {
        let val = 0, digits = 0;
        i += 2;
        while (digits < 2 && i < str.length) {
          const h = parseInt(str[i], 16);
          if (Number.isNaN(h)) break;
          val = val * 16 + h;
          i++;
          digits++;
        }
        out.push(val & 0xff);
      } else if (n >= 0x30 && n <= 0x37 /* octal 0-7 */) {
        let val = 0, digits = 0;
        i += 1;
        while (digits < 3 && i < str.length) {
          const o = str.charCodeAt(i) - 0x30;
          if (o < 0 || o > 7) break;
          val = val * 8 + o;
          i++;
          digits++;
        }
        out.push(val & 0xff);
      } else {
        /* simple escapes */
        i += 2;
        switch (String.fromCharCode(n)) {
          case 'n': out.push(0x0a); break;
          case 'r': out.push(0x0d); break;
          case 't': out.push(0x09); break;
          case '0': out.push(0x00); break;
          default: out.push(n & 0xff); break; /* \\ \" \' etc */
        }
      }
    } else {
      out.push(c & 0xff);
      i++;
    }
  }
  return new Uint8Array(out);
}

/* ---------------------------------------------------------------- */
/* the font object                                                  */

export class U8g2Font {
  /**
   * @param {Uint8Array} data font byte stream (new font format)
   */
  constructor(data) {
    this.data = data;
    this.info = this.readFontInfo();
  }

  /* ---------- factories ---------------------------------------- */

  static fromArray(data) {
    if (data instanceof Uint8Array) return new U8g2Font(data);
    return new U8g2Font(new Uint8Array(data));
  }

  static fromBase64(b64) {
    return new U8g2Font(base64ToBytes(b64));
  }

  /** Accept a raw C string literal (as pasted from a generated .c file). */
  static fromC(cString) {
    return new U8g2Font(parseCStringBytes(cString));
  }

  /**
   * Load a font.  In the browser this fetches the URL (works with relative
   * paths and http(s)).  In Node it reads from the local filesystem.
   */
  static async load(url) {
    const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
    const isHttp = /^https?:/i.test(url);
    if (!isNode || isHttp) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`U8g2Font.load: ${res.status} ${url}`);
      return new U8g2Font(new Uint8Array(await res.arrayBuffer()));
    }
    const { readFile } = await import('node:fs/promises');
    const buf = await readFile(url);
    return new U8g2Font(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  }

  /* ---------- registry ------------------------------------------ */

  static register(name, font) {
    const f = font instanceof U8g2Font ? font : U8g2Font.fromArray(font);
    fonts[name] = f;
    return f;
  }

  /** All fonts registered by name (the runtime registry). */
  static registered() { return fonts; }

  static resolve(font) {
    if (font instanceof U8g2Font) return font;
    if (typeof font === 'string') {
      if (fonts[font]) return fonts[font];
      /* treat as base64 */
      try { return U8g2Font.fromBase64(font); } catch { /* ignore */ }
    }
    if (font instanceof Uint8Array || Array.isArray(font)) return U8g2Font.fromArray(font);
    return null;
  }

  /** base64 of this font (for export / storage). */
  toBase64() { return bytesToBase64(this.data); }

  /* ---------- low level byte access ----------------------------- */

  getByte(offset) { return this.data[offset]; }
  getWord(offset) { return (this.data[offset] << 8) | this.data[offset + 1]; }

  static getByte(data, offset) { return data[offset]; }
  static getWord(data, offset) { return (data[offset] << 8) | data[offset + 1]; }

  /* ---------- header (u8g2_read_font_info) ---------------------- */

  readFontInfo() {
    const b = (off) => this.getByte(off);
    const s8 = (off) => { const v = this.getByte(off); return v > 127 ? v - 256 : v; };
    return {
      glyph_cnt: b(0),
      bbx_mode: b(1),
      bits_per_0: b(2),
      bits_per_1: b(3),
      bits_per_char_width: b(4),
      bits_per_char_height: b(5),
      bits_per_char_x: b(6),
      bits_per_char_y: b(7),
      bits_per_delta_x: b(8),
      max_char_width: b(9),
      max_char_height: b(10),
      x_offset: s8(11),
      y_offset: s8(12),
      ascent_A: b(13),
      descent_g: s8(14),
      ascent_para: b(15),
      descent_para: s8(16),
      start_pos_upper_A: this.getWord(17),
      start_pos_lower_a: this.getWord(19),
      start_pos_unicode: this.getWord(21),
    };
  }

  /* ---------- total size (u8g2_GetFontSize) --------------------- */

  getFontSize() {
    let font = FONT_DATA_STRUCT_SIZE;
    for (;;) {
      if (this.getByte(font + 1) === 0) break;
      font += this.getByte(font + 1);
    }
    font += 2;
    font += this.getWord(font);
    for (;;) {
      const e = this.getWord(font);
      if (e === 0) break;
      font += this.getByte(font + 2);
    }
    return (font - 0) + 2;
  }

  /* ---------- bitstream decoder (u8g2_font_decode_get_*) -------- */

  /**
   * @param {object} state { ptr, bitPos } mutated in place
   * @returns {number} unsigned cnt-bit value
   */
  getUnsignedBits(state, cnt) {
    const data = this.data;
    let val = data[state.ptr];
    val >>= state.bitPos;
    let bitPosPlusCnt = state.bitPos + cnt;
    if (bitPosPlusCnt >= 8) {
      const s = 8 - state.bitPos;
      state.ptr++;
      val |= data[state.ptr] << s;
      bitPosPlusCnt -= 8;
    }
    val &= (1 << cnt) - 1;
    state.bitPos = bitPosPlusCnt;
    return val;
  }

  getSignedBits(state, cnt) {
    const v = this.getUnsignedBits(state, cnt);
    let d = 1;
    cnt--;
    d <<= cnt;
    return v - d;
  }

  /* ---------- glyph lookup (u8g2_font_get_glyph_data) ----------- */

  /**
   * Find the start offset of the glyph data for `encoding`.
   * @returns {number} offset into this.data, or -1 if not present
   */
  getGlyphData(encoding) {
    const info = this.info;
    const len = this.data.length;
    let font = FONT_DATA_STRUCT_SIZE;
    if (encoding <= 255) {
      if (encoding >= 0x61 /* 'a' */) font += info.start_pos_lower_a;
      else if (encoding >= 0x41 /* 'A' */) font += info.start_pos_upper_A;
      for (;;) {
        if (font + 1 >= len) break;
        if (this.getByte(font + 1) === 0) break; /* table terminator */
        if (this.getByte(font) === encoding) return font + 2;
        font += this.getByte(font + 1);
      }
    } else {
      font += info.start_pos_unicode;
      if (font >= len) return -1;
      let unicodeLookupTable = font;
      let e;
      /* bounds-guarded scan of the unicode lookup table (the C original
         relies on well-formed fonts and would otherwise read out of bounds
         for encodings beyond the font's max range) */
      for (;;) {
        if (unicodeLookupTable + 4 > len) return -1;
        font += this.getWord(unicodeLookupTable);       /* bytes to skip */
        e = this.getWord(unicodeLookupTable + 2);       /* end encoding */
        unicodeLookupTable += 4;
        if (e >= encoding) break;
      }
      for (;;) {
        if (font + 2 > len) return -1;
        e = this.getWord(font);
        if (e === 0) break;
        if (e === encoding) return font + 3;
        font += this.getByte(font + 2);
      }
    }
    return -1;
  }

  /** 1 if the encoding exists in the font (u8g2_IsGlyph). */
  hasGlyph(encoding) { return this.getGlyphData(encoding) !== -1; }

  /**
   * Read the glyph header: width, x offset, delta-x (u8g2_GetGlyphWidth
   * side effects).  Returns null if the encoding is not present.
   */
  getGlyphProps(encoding) {
    const glyphData = this.getGlyphData(encoding);
    if (glyphData === -1) return null;
    const state = { ptr: glyphData, bitPos: 0 };
    const width = this.getUnsignedBits(state, this.info.bits_per_char_width);
    const height = this.getUnsignedBits(state, this.info.bits_per_char_height);
    const ox = this.getSignedBits(state, this.info.bits_per_char_x);
    const oy = this.getSignedBits(state, this.info.bits_per_char_y);
    const dx = this.getSignedBits(state, this.info.bits_per_delta_x);
    return { width, height, ox, oy, dx };
  }

  /** Convenience: human readable summary. */
  describe() {
    const i = this.info;
    return {
      glyph_cnt: i.glyph_cnt,
      bbx_mode: i.bbx_mode,
      max_char_width: i.max_char_width,
      max_char_height: i.max_char_height,
      ascent_A: i.ascent_A,
      descent_g: i.descent_g,
    };
  }
}

/* runtime font registry */
export const fonts = {};
