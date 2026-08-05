/**
 * pbm.js
 *
 * Export helpers used for headless verification (Node) and diagnostics.
 * The PBM output covers the visible panel region of the display memory in
 * native orientation (rotation 0), which is what the raw panel shows before
 * any mount rotation.
 */

/** Read one pixel of the display memory in native controller layout. */
export function pixelAt(u8g2, x, y) {
  const di = u8g2.displayInfo;
  const mem = u8g2.displayMemory;
  if (x < 0 || y < 0 || x >= di.tileWidth * 8 || y >= di.tileHeight * 8) return 0;
  if (di.layout === 'horizontal') {
    return (mem[y * di.tileWidth + (x >> 3)] & (128 >> (x & 7))) ? 1 : 0;
  }
  return (mem[(y & ~7) * di.tileWidth + x] >> (y & 7)) & 1;
}

/** Raw bytes of the display memory. */
export function toBIN(u8g2) {
  return u8g2.displayMemory.slice();
}

/**
 * Binary PBM (P4) of the visible panel region.
 * @returns {string} the PBM file content
 */
export function toPBM(u8g2) {
  const di = u8g2.displayInfo;
  const w = di.pixelWidth;
  const h = di.pixelHeight;
  const rowBytes = Math.ceil(w / 8);
  const out = new Uint8Array(2 + 1 + String(w).length + 1 + String(h).length + 1 + rowBytes * h);

  const header = `P4\n${w} ${h}\n`;
  let pos = 0;
  for (let i = 0; i < header.length; i++) out[pos++] = header.charCodeAt(i);

  for (let y = 0; y < h; y++) {
    let byte = 0;
    for (let x = 0; x < w; x++) {
      byte = (byte << 1) | (pixelAt(u8g2, x, y) & 1);
      if ((x & 7) === 7) {
        out[pos++] = byte;
        byte = 0;
      }
    }
    if ((w & 7) !== 0) out[pos++] = byte << (8 - (w & 7));
  }
  /* trim to exact length */
  return String.fromCharCode(...out.subarray(0, pos));
}

/**
 * Parse a binary PBM (P4) back into pixels.
 * @returns {{width:number, height:number, pixels:Uint8Array}} pixels = width*height, 1 bit each
 */
export function parsePBM(pbm) {
  const lines = pbm.split('\n');
  const header = [];
  let i = 0;
  /* magic */
  if (lines[i] !== 'P4') throw new Error('parsePBM: not a P4 file');
  i++;
  while (i < lines.length) {
    const line = lines[i].replace(/\s*#.*$/, '').trim();
    if (!line) { i++; continue; }
    if (!header.length) {
      const parts = line.split(/\s+/);
      header.push(...parts);
      i++;
      continue;
    }
    break;
  }
  const width = parseInt(header[0], 10);
  const height = parseInt(header[1], 10);
  const rowBytes = Math.ceil(width / 8);
  const data = pbm.substr(pbm.indexOf('\n', pbm.indexOf('\n') + 1) + 1);
  const bytes = data.split('').map((c) => c.charCodeAt(0));

  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const b = bytes[y * rowBytes + (x >> 3)];
      const bit = (b >> (7 - (x & 7))) & 1;
      pixels[y * width + x] = bit;
    }
  }
  return { width, height, pixels };
}

/** ASCII PBM (P1) for eyeball debugging. */
export function toPBMP1(u8g2) {
  const di = u8g2.displayInfo;
  const w = di.pixelWidth;
  const h = di.pixelHeight;
  let s = `P1\n${w} ${h}\n`;
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) row += pixelAt(u8g2, x, y) ? '1' : '0';
    s += row + '\n';
  }
  return s;
}
