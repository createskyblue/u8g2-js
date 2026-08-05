/**
 * hvline.js
 *
 * Low-level horizontal/vertical line drawing into the tile buffer.
 * Faithful port of u8g2_ll_hvline.c (both byte layouts, speed-optimized
 * variants which are what the firmware uses).
 *
 * draw_color semantics (identical to C):
 *   color 0 -> clear pixel  (or_mask = mask, xor_mask = mask)
 *   color 1 -> set pixel    (or_mask = mask, xor_mask = 0)
 *   color 2 -> toggle pixel (or_mask = 0,     xor_mask = mask)
 *
 * Both functions receive coordinates already relative to the current buffer
 * (i.e. `pixel_curr_row` has been subtracted) and assume all clipping done.
 */

/**
 * SSD13xx-style layout: each byte is one column of 8 pixels, bit 0 = top.
 * Buffer byte = (y & ~7) * tileWidth + x, bit = y & 7.
 * A vertical advance that crosses a band boundary jumps pixelBufWidth bytes
 * (= tileWidth * 8).
 */
export function llHVLineVerticalTopLsb(u8g2, x, y, len, dir) {
  let bitPos = y & 7;
  let mask = 1 << bitPos;
  let orMask = 0;
  let xorMask = 0;
  if (u8g2.drawColor <= 1) orMask = mask;
  if (u8g2.drawColor !== 1) xorMask = mask;

  const buf = u8g2.tileBuf;
  let ptr = (y & ~7) * u8g2.tileWidth + x;

  if (dir === 0) {
    /* horizontal, left -> right */
    do {
      buf[ptr] |= orMask;
      buf[ptr] ^= xorMask;
      ptr++;
      len--;
    } while (len !== 0);
  } else {
    /* vertical, top -> bottom */
    do {
      buf[ptr] |= orMask;
      buf[ptr] ^= xorMask;

      bitPos++;
      bitPos &= 7;
      len--;

      if (bitPos === 0) {
        ptr += u8g2.pixelBufWidth; /* next 8-pixel band */
        if (u8g2.drawColor <= 1) orMask = 1;
        if (u8g2.drawColor !== 1) xorMask = 1;
      } else {
        orMask <<= 1;
        xorMask <<= 1;
      }
    } while (len !== 0);
  }
}

/**
 * ST7920-style layout: each byte is one row of 8 pixels, MSB first.
 * Buffer byte = y * tileWidth + (x >> 3), bit = 128 >> (x & 7).
 */
export function llHVLineHorizontalRightLsb(u8g2, x, y, len, dir) {
  const tileWidth = u8g2.tileWidth;
  const buf = u8g2.tileBuf;
  let mask = 128 >> (x & 7);
  let offset = y * tileWidth + (x >> 3);

  if (dir === 0) {
    /* horizontal, left -> right */
    do {
      if (u8g2.drawColor <= 1) buf[offset] |= mask;
      if (u8g2.drawColor !== 1) buf[offset] ^= mask;
      mask >>= 1;
      if (mask === 0) {
        mask = 128;
        offset++;
      }
      len--;
    } while (len !== 0);
  } else {
    /* vertical, top -> bottom */
    do {
      if (u8g2.drawColor <= 1) buf[offset] |= mask;
      if (u8g2.drawColor !== 1) buf[offset] ^= mask;
      offset += tileWidth;
      len--;
    } while (len !== 0);
  }
}
