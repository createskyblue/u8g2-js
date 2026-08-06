/* chinese-fonts-demo.js
 *
 * Standalone page: render the classic font-test sentence
 * 「我能吞下玻璃而不伤身体」in EVERY built-in full-CJK font (12/16/24/32 px)
 * so one page shows all their effects side by side. The font name is appended
 * to the sentence on screen.
 *
 * Each panel is a generous 512×512 virtual screen (this is pure simulation,
 * no hardware constraints), drawn with u8g2-js' pixel-faithful renderer.
 *
 * Bundled into demo/chinese-fonts-demo.html by tools/build-chinese-demo.js.
 */
import { U8g2, U8g2Font } from '../src/index.js';
import { chinese_full_12 } from './fonts/chinese_full_12.js';
import { chinese_full_16 } from './fonts/chinese_full_16.js';
import { chinese_full_24 } from './fonts/chinese_full_24.js';
import { chinese_full_32 } from './fonts/chinese_full_32.js';

const QUOTE = '我能吞下玻璃而不伤身体';
const VW = 512;
const VH = 512;
/* 虚拟屏放大倍数：小字号放大更足，保证每个字形肉眼可判读 */
const CFG = [
  { name: 'chinese_full_12', scale: 2 },
  { name: 'chinese_full_16', scale: 2 },
  { name: 'chinese_full_24', scale: 2 },
  { name: 'chinese_full_32', scale: 2 },
];

U8g2Font.register('chinese_full_12', U8g2Font.fromBase64(chinese_full_12));
U8g2Font.register('chinese_full_16', U8g2Font.fromBase64(chinese_full_16));
U8g2Font.register('chinese_full_24', U8g2Font.fromBase64(chinese_full_24));
U8g2Font.register('chinese_full_32', U8g2Font.fromBase64(chinese_full_32));

/** wrap long text into lines that fit maxW (character granularity). */
function wrapText(u8g2, text, maxW) {
  const lines = [];
  let cur = '';
  for (const ch of text) {
    if (cur && u8g2.getUTF8Width(cur + ch) > maxW) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function renderPanels() {
  const host = document.getElementById('panels');
  for (const { name, scale } of CFG) {
    const text = `${QUOTE} ${name}`; // 名言最后附上字体名

    const u8g2 = new U8g2({ width: VW, height: VH });
    u8g2.setFont(name);
    u8g2.clearBuffer();

    const lineH = u8g2.getMaxCharHeight() + 2;
    const lines = wrapText(u8g2, text, VW - 12);
    /* 垂直居中 */
    let y = ((VH - lines.length * lineH) >> 1) + u8g2.getAscent();
    for (const line of lines) {
      u8g2.drawUTF8(6, y, line);
      y += lineH;
    }
    u8g2.sendBuffer();

    const panel = document.createElement('div');
    panel.className = 'panel';
    const caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = `${name}  ·  ${text}`;
    const canvas = document.createElement('canvas');
    panel.append(caption, canvas);
    host.appendChild(panel);
    u8g2.attachCanvas(canvas, { scale });
  }
}

renderPanels();
