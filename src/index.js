/**
 * u8g2-js — unified entry point.
 *
 *   import { U8g2, U8g2Font } from './u8g2-js/src/index.js'
 *
 *   const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' })
 *   u8g2.setFont(U8g2Font.fromC("\\277\\0\\2..."))   // or fromBase64 / load()
 *   u8g2.clearBuffer()
 *   u8g2.drawStr(0, 10, "Hello")
 *   u8g2.sendBuffer()
 *
 * Browser: this module is dependency-free ESM and works from file:// too.
 * Node:    same module works headless (render via renderer/pbm.js).
 */

export { U8g2, U8G2_R0, U8G2_R1, U8G2_R2, U8G2_R3,
         U8G2_FONT_HEIGHT_MODE_TEXT, U8G2_FONT_HEIGHT_MODE_XTEXT, U8G2_FONT_HEIGHT_MODE_ALL } from './u8g2.js';

export { U8g2Font, fonts, parseCStringBytes } from './font.js';

export { PRESETS, resolveDisplay, listPresets } from './setup.js';

export {
  U8G2_DRAW_UPPER_RIGHT, U8G2_DRAW_UPPER_LEFT, U8G2_DRAW_LOWER_RIGHT, U8G2_DRAW_LOWER_LEFT,
  U8G2_DRAW_ALL,
  U8G2_BTN_BW1, U8G2_BTN_BW2, U8G2_BTN_BW3, U8G2_BTN_BW_MASK,
  U8G2_BTN_SHADOW0, U8G2_BTN_SHADOW1, U8G2_BTN_SHADOW2, U8G2_BTN_SHADOW_MASK,
  U8G2_BTN_INV, U8G2_BTN_HCENTER, U8G2_BTN_XFRAME,
} from './draw.js';

export { createCanvasRenderer } from './renderer/canvas.js';
export { pixelAt, toBIN, toPBM, parsePBM, toPBMP1 } from './renderer/pbm.js';
export { U8G2_UTF8_END, U8G2_UTF8_CONTINUE } from './utf8.js';
