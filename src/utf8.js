/**
 * utf8.js
 *
 * Port of u8x8_ascii_next / u8x8_utf8_next from the U8G2 library
 * (u8x8_8x8.c).  These are byte-wise state machines that turn a UTF-8
 * byte stream into a sequence of 16-bit Unicode encodings.
 *
 * Return codes (same as the C original):
 *   0x0fffe  -> "continue, more bytes expected / invalid byte, keep going"
 *   0x0ffff  -> "end of string"
 *   else     -> a Unicode code point to draw
 */

/* end-of-string marker */
export const U8G2_UTF8_END = 0x0ffff;
/* continue marker */
export const U8G2_UTF8_CONTINUE = 0x0fffe;

/**
 * State used by the UTF-8 decoder.  One instance per draw/width call.
 */
export function utf8Init() {
  return { utf8State: 0, encoding: 0 };
}

/**
 * ASCII only decoder.  b === 0 (NUL) terminates the string.
 * Signature matches utf8Next(state, b); state is unused.
 */
export function asciiNext(state, b) {
  if (b === 0) return U8G2_UTF8_END;
  return b;
}

/**
 * Full UTF-8 decoder.  Faithful port of u8x8_utf8_next().
 * Note: in the original, b === 0 or b === '\n' terminates the string
 * (this supports u8g2's string-list procedures).
 */
export function utf8Next(state, b) {
  if (b === 0 || b === 0x0a /* '\n' */) {
    return U8G2_UTF8_END; /* end of string detected, pending UTF8 is discarded */
  }
  if (state.utf8State === 0) {
    if (b >= 0xfc) {
      /* 6 byte sequence */
      state.utf8State = 5;
      b &= 1;
    } else if (b >= 0xf8) {
      state.utf8State = 4;
      b &= 3;
    } else if (b >= 0xf0) {
      state.utf8State = 3;
      b &= 7;
    } else if (b >= 0xe0) {
      state.utf8State = 2;
      b &= 15;
    } else if (b >= 0xc0) {
      state.utf8State = 1;
      b &= 0x01f;
    } else {
      /* single byte, just use the value as encoding */
      return b;
    }
    state.encoding = b;
    return U8G2_UTF8_CONTINUE;
  } else {
    state.utf8State--;
    /* the case b < 0x080 (an illegal UTF8 encoding) is not checked here,
       matching the original */
    state.encoding <<= 6;
    b &= 0x03f;
    state.encoding |= b;
    if (state.utf8State !== 0) {
      return U8G2_UTF8_CONTINUE; /* nothing to do yet */
    }
  }
  return state.encoding;
}

/**
 * Decode the first code point of a JS string into (codePoint, indexAfter).
 * Useful for callers that hand JS strings (not byte streams) to the library.
 * This is NOT part of the C library; it is a convenience helper.
 */
export function nextCodePoint(str, i) {
  const cp = str.codePointAt(i);
  if (cp === undefined) return U8G2_UTF8_END;
  return [cp, i + (cp > 0xffff ? 2 : 1)];
}
