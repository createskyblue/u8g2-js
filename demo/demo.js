/**
 * demo.js — interactive U8G2 browser simulator.
 *
 * Write U8G2 sketch code in the editor and run it against the pixel-faithful
 * JS port.  Load any font at runtime (dropdown, .bin file, or base64 paste).
 * Run via a live HTTP server from the project root, then open demo/demo.html
 * (ES modules load fonts on demand; there is no pre-built single-file build).
 */
import {
  U8g2, U8g2Font, listPresets,
  U8G2_R0, U8G2_R1, U8G2_R2, U8G2_R3,
} from '../src/index.js';

import { u8g2_font_5x7_tf } from '../fonts/u8g2_font_5x7_tf.js';
import { u8g2_font_5x7_mf } from '../fonts/u8g2_font_5x7_mf.js';
import { u8g2_font_6x10_tf } from '../fonts/u8g2_font_6x10_tf.js';
import { u8g2_font_7x13_tf } from '../fonts/u8g2_font_7x13_tf.js';
import { u8g2_font_7x14_tf } from '../fonts/u8g2_font_7x14_tf.js';
import { u8g2_font_8x13_tf } from '../fonts/u8g2_font_8x13_tf.js';
import { u8g2_font_10x20_tf } from '../fonts/u8g2_font_10x20_tf.js';
import { u8g2_font_open_iconic_weather_1x_t } from '../fonts/u8g2_font_open_iconic_weather_1x_t.js';
import { u8g2_font_unifont_t_symbols } from '../fonts/u8g2_font_unifont_t_symbols.js';
import { chinese_full_8 } from '../fonts/chinese_full_8.js';
import { chinese_full_10 } from '../fonts/chinese_full_10.js';
import { chinese_full_12 } from '../fonts/chinese_full_12.js';
import { chinese_full_16 } from '../fonts/chinese_full_16.js';
import { chinese_full_24 } from '../fonts/chinese_full_24.js';
import { chinese_full_32 } from '../fonts/chinese_full_32.js';

const FONTS = {
  u8g2_font_5x7_tf,
  u8g2_font_5x7_mf,
  u8g2_font_6x10_tf,
  u8g2_font_7x13_tf,
  u8g2_font_7x14_tf,
  u8g2_font_8x13_tf,
  u8g2_font_10x20_tf,
  u8g2_font_open_iconic_weather_1x_t,
  u8g2_font_unifont_t_symbols,
  /* 全量中文字库（U+4E00-9FFF + ASCII + 标点，21158 字形） */
  chinese_full_8,
  chinese_full_10,
  chinese_full_12,
  chinese_full_16,
  chinese_full_24,
  chinese_full_32,
};

/* register the bundled fonts by name */
for (const [name, b64] of Object.entries(FONTS)) {
  U8g2Font.register(name, U8g2Font.fromBase64(b64));
}

/* default sketch (runs as an animation) */
const DEFAULT_CODE = `// u8g2-js 仿真 —— 在浏览器里写 U8G2 代码（内置全量中文字库）
// 可用变量: u8g2(主对象), $t(秒), state(帧间持久对象)
u8g2.clearBuffer();

// 标题（全量中文字库 16px）
u8g2.setFont('chinese_full_16');
u8g2.drawUTF8(0, 16, '温度传感器');
u8g2.drawHLine(0, 20, 128);

// 当前温度（24px 中文 + 数字）
const val = 22 + Math.round(6 * Math.sin($t));
u8g2.setFont('chinese_full_24');
u8g2.drawUTF8(2, 50, val + '℃');

// 垂直进度条
const y = 26, h = 34;
u8g2.setFont('chinese_full_12');
u8g2.drawUTF8(70, 34, '湿度');
u8g2.drawFrame(70, 36, 20, 24);
const fill = Math.round(24 * (50 + 30 * Math.sin($t + 1)) / 100);
u8g2.drawBox(71, 60 - fill, 18, fill);

// 状态行
u8g2.setFont('chinese_full_12');
u8g2.drawUTF8(0, 62, '运行正常');

u8g2.sendBuffer();
`;

const PRESET_NAMES = listPresets();

/* ---------------------------------------------------------------- */
/* state                                                             */

let u8g2 = null;
let renderer = null;
let currentCode = DEFAULT_CODE;
let anim = false;
let animTimer = null;
let startTime = 0;
const state = {};

const $ = (id) => document.getElementById(id);

/* ---------------------------------------------------------------- */
/* display setup                                                     */

function currentDisplaySpec() {
  const sel = $('displaySel').value;
  if (sel === '__custom__') {
    return {
      width: parseInt($('customW').value, 10) || 128,
      height: parseInt($('customH').value, 10) || 64,
    };
  }
  return { display: sel };
}

function currentRotation() {
  return [U8G2_R0, U8G2_R1, U8G2_R2, U8G2_R3][parseInt($('rotSel').value, 10) || 0];
}

function rebuildDisplay() {
  u8g2 = new U8g2(currentDisplaySpec());
  u8g2.setDisplayRotation(currentRotation());
  renderer = u8g2.attachCanvas($('canvas'), {});
  applyRendererOptions();
  updateStatus();
  run();
}

/* ---------------------------------------------------------------- */
/* rendering options                                                 */

function applyRendererOptions() {
  if (!renderer) return;
  renderer.setOptions({
    scale: parseInt($('zoomSel').value, 10) || 4,
    showGrid: $('gridChk').checked,
  });
  u8g2.render();
}

/* ---------------------------------------------------------------- */
/* run the user code                                                 */

function run() {
  if (!u8g2) return;
  try {
    const fn = new Function('u8g2', 'state', '$t', currentCode);
    fn(u8g2, state, (performance.now() - startTime) / 1000);
    u8g2.sendBuffer(); /* idempotent; harmless if the code already sent */
    $('statusMsg').textContent = 'ok';
  } catch (err) {
    $('statusMsg').textContent = '✖ ' + err.message;
    console.error(err);
  }
  updateStatus();
}

function updateStatus() {
  if (!u8g2) return;
  const di = u8g2.displayInfo;
  $('statusInfo').textContent =
    `screen ${u8g2.getDisplayWidth()}×${u8g2.getDisplayHeight()}  ·  ` +
    `tiles ${di.tileWidth}×${di.tileHeight}  ·  buffer ${u8g2.getBufferSize()} B  ·  ` +
    `rotation R${u8g2.rotation}  ·  font ${u8g2.font ? fontNameOf(u8g2.font) : '(none)'}`;
}

function fontNameOf(font) {
  for (const [n, f] of Object.entries(U8g2Font.registered())) {
    if (f === font) return n;
  }
  return '?';
}

/* ---------------------------------------------------------------- */
/* animation                                                         */

function toggleAnim() {
  anim = !anim;
  $('animBtn').textContent = anim ? '⏸ 停止' : '▶ 动画';
  if (anim) {
    startTime = performance.now();
    animTimer = setInterval(() => run(), 80);
  } else {
    clearInterval(animTimer);
    animTimer = null;
  }
}

/* ---------------------------------------------------------------- */
/* font loading                                                      */

function populateFontSelect() {
  const sel = $('fontSel');
  sel.innerHTML = '';
  for (const name of Object.keys(U8g2Font.registered())) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  }
  sel.value = 'chinese_full_16';
}

function applySelectedFont() {
  const name = $('fontSel').value;
  if (u8g2 && name) {
    u8g2.setFont(name);
    updateStatus();
    run();
  }
}

function registerFont(name, font, notify = true) {
  U8g2Font.register(name, font);
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name;
  $('fontSel').appendChild(opt);
  $('fontSel').value = name;
  if (notify) {
    $('statusMsg').textContent = `loaded font "${name}" (${font.data.length} B)`;
    if (u8g2) { u8g2.setFont(name); run(); }
  }
}

/* ---------------------------------------------------------------- */
/* wire up the UI                                                    */

function setupUI() {
  /* display presets */
  const sel = $('displaySel');
  for (const name of PRESET_NAMES) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  }
  const custom = document.createElement('option');
  custom.value = '__custom__';
  custom.textContent = '自定义屏…';
  sel.appendChild(custom);
  sel.value = 'ssd1306_128x64_noname_f';

  $('displaySel').onchange = () => {
    const isCustom = $('displaySel').value === '__custom__';
    $('customSize').style.display = isCustom ? 'block' : 'none';
    rebuildDisplay();
  };
  $('customW').onchange = rebuildDisplay;
  $('customH').onchange = rebuildDisplay;
  $('rotSel').onchange = () => { u8g2.setDisplayRotation(currentRotation()); run(); };
  $('zoomSel').onchange = applyRendererOptions;
  $('gridChk').onchange = applyRendererOptions;

  /* code editor */
  $('code').value = DEFAULT_CODE;
  $('code').oninput = () => { currentCode = $('code').value; state.cnt = 0; };
  $('runBtn').onclick = run;
  $('clearBtn').onclick = () => {
    u8g2.clearBuffer();
    u8g2.sendBuffer();
    $('statusMsg').textContent = 'buffer cleared';
  };
  $('animBtn').onclick = toggleAnim;
  $('demoBtn').onclick = () => {
    $('code').value = DEFAULT_CODE;
    currentCode = DEFAULT_CODE;
    run();
  };

  /* font select + custom font loading */
  populateFontSelect();
  $('fontSel').onchange = applySelectedFont;
  $('fontFile').onchange = async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const buf = new Uint8Array(await file.arrayBuffer());
    const name = file.name.replace(/\.(bin|js)$/i, '');
    registerFont(name, U8g2Font.fromArray(buf));
  };
  $('fontBase64').oninput = () => {
    const v = $('fontBase64').value.trim();
    if (v.length > 8) {
      try {
        registerFont('custom_' + v.length, U8g2Font.fromBase64(v));
      } catch { /* incomplete paste */ }
    }
  };

  rebuildDisplay();
}

/* expose for headless checks (tools/check-demo.js) */
window.u8g2demo = { run, rebuildDisplay, toggleAnim };

document.addEventListener('DOMContentLoaded', setupUI);
