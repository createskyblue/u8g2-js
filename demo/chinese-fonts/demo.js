/* demo/chinese-fonts/demo.js
 *
 * 中文字体家族对比页：选项卡（或 ← → 方向键）切换家族，字体**按需动态加载**——
 * 切到某个家族时才 import 它的字体模块（第一次加载后注册进运行时注册表，之后直接复用）。
 * 每个家族一块 1920×1080 虚拟屏（恰好 2 倍整数放大、像素对齐、无 CSS 缩放），
 * 用「我能吞下玻璃而不伤身体」渲染该家族的字号，句末附字体名。
 */
import { U8g2, U8g2Font } from '../../src/index.js';

const QUOTE = '我能吞下玻璃而不伤身体';
const VW = 1920;
const VH = 1080;
const GAP = 14;

/* 每个家族：名字 + 要展示的字库名（按从上到下顺序） */
const FAMILIES = [
  { label: 'SimSun 宋体', fonts: ['chinese_full_8', 'chinese_full_10', 'chinese_full_12', 'chinese_full_16', 'chinese_full_24', 'chinese_full_32'] },
  { label: 'MapleMono NF CN Light', fonts: ['chinese_maplelight_12', 'chinese_maplelight_16', 'chinese_maplelight_24'] },
  { label: 'MapleMono NF CN LightItalic', fonts: ['chinese_maplelightitalic_12', 'chinese_maplelightitalic_16', 'chinese_maplelightitalic_24'] },
  { label: 'MapleMono NF CN Regular', fonts: ['chinese_mapleregular_12', 'chinese_mapleregular_16', 'chinese_mapleregular_24'] },
  { label: 'MapleMono NF CN Medium', fonts: ['chinese_maplemedium_12', 'chinese_maplemedium_16', 'chinese_maplemedium_24'] },
  { label: 'MapleMono NF CN SemiBold', fonts: ['chinese_maplesemibold_12', 'chinese_maplesemibold_16', 'chinese_maplesemibold_24'] },
  { label: 'MapleMono NF CN Bold', fonts: ['chinese_maplebold_12', 'chinese_maplebold_16', 'chinese_maplebold_24'] },
  { label: 'MapleMono NF CN BoldItalic', fonts: ['chinese_maplebolditalic_12', 'chinese_maplebolditalic_16', 'chinese_maplebolditalic_24'] },
  { label: 'MapleMono NF CN ExtraBold', fonts: ['chinese_mapleextrabold_12', 'chinese_mapleextrabold_16', 'chinese_mapleextrabold_24'] },
  { label: 'MapleMono NF CN ExtraLight', fonts: ['chinese_mapleextralight_12', 'chinese_mapleextralight_16', 'chinese_mapleextralight_24'] },
  { label: 'MapleMono NF CN Thin', fonts: ['chinese_maplethin_12', 'chinese_maplethin_16', 'chinese_maplethin_24'] },
  { label: 'SimHei 黑体', fonts: ['chinese_simhei_12', 'chinese_simhei_16', 'chinese_simhei_24'] },
  { label: 'Microsoft YaHei 微软雅黑', fonts: ['chinese_msyh_12', 'chinese_msyh_16', 'chinese_msyh_24'] },
  { label: 'Microsoft YaHei Light 微软雅黑细', fonts: ['chinese_msyhl_12', 'chinese_msyhl_16', 'chinese_msyhl_24'] },
  { label: 'KaiTi 楷体', fonts: ['chinese_kaiti_12', 'chinese_kaiti_16', 'chinese_kaiti_24'] },
  { label: 'FangSong 仿宋', fonts: ['chinese_fangsong_12', 'chinese_fangsong_16', 'chinese_fangsong_24'] },
  { label: 'Noto Sans SC 思源黑体', fonts: ['chinese_notosans_12', 'chinese_notosans_16', 'chinese_notosans_24'] },
  { label: 'DengXian 等线', fonts: ['chinese_deng_12', 'chinese_deng_16', 'chinese_deng_24'] },
];

const canvas = document.getElementById('screen');
const u8g2 = new U8g2({ width: VW, height: VH });
u8g2.attachCanvas(canvas, { scale: 2, pad: 0 }); /* 恰好 2 倍，不多不少 */

let active = 0;
let busy = false;

/** 按需加载一个家族的字库（首次 import，之后复用注册表），然后渲染。 */
async function loadAndShow(i) {
  if (busy) return;
  busy = true;
  active = ((i % FAMILIES.length) + FAMILIES.length) % FAMILIES.length;
  document.querySelectorAll('.tab').forEach((t, idx) => t.classList.toggle('active', idx === active));
  const fam = FAMILIES[active];
  document.getElementById('name').textContent = `${fam.label}（${fam.fonts.length} 档）`;
  document.getElementById('status').textContent = `正在按需加载 ${fam.label} …`;
  try {
    for (const name of fam.fonts) {
      if (!U8g2Font.registered()[name]) {
        const mod = await import(`../fonts/${name}.js`);
        U8g2Font.register(name, U8g2Font.fromBase64(mod[name]));
      }
    }
    render(fam);
    document.getElementById('status').textContent = `已加载 ${fam.fonts.length} 档字体，点击选项卡或 ← → 切换`;
  } catch (err) {
    document.getElementById('status').textContent = `加载失败：${err.message}`;
  }
  busy = false;
}

/** 在 1920×1080 虚拟屏上从上到下渲染该家族的各档字体。 */
function render(fam) {
  u8g2.clearBuffer();
  const rows = [];
  let totalH = 0;
  for (const name of fam.fonts) {
    u8g2.setFont(name);
    const lineH = u8g2.getMaxCharHeight() + 2;
    const lines = wrapWords(u8g2, `${QUOTE} ${name}`, VW - 12);
    rows.push({ name, lines, lineH });
    totalH += lines.length * lineH;
  }
  totalH += GAP * (fam.fonts.length - 1);

  let y = ((VH - totalH) >> 1) + 2;
  for (const { name, lines, lineH } of rows) {
    u8g2.setFont(name);
    for (const line of lines) {
      u8g2.drawUTF8(6, y, line);
      y += lineH;
    }
    y += GAP;
  }
  u8g2.sendBuffer();
}

function wrapWords(u8g2, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && u8g2.getUTF8Width(t) > maxW) {
      lines.push(cur);
      cur = w;
    } else {
      cur = t;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/* 选项卡 */
const tabsEl = document.getElementById('tabs');
FAMILIES.forEach((fam, i) => {
  const b = document.createElement('button');
  b.className = 'tab';
  b.textContent = fam.label;
  b.addEventListener('click', () => loadAndShow(i));
  tabsEl.appendChild(b);
});

/* 左右方向键切换 */
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') loadAndShow(active + 1);
  else if (e.key === 'ArrowLeft') loadAndShow(active - 1);
});

loadAndShow(0);
