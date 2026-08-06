/* Bomberman — Arduboy2 game ported to u8g2-js.
 *
 * Original: https://github.com/createskyblue/Bomberman (Bomberman.ino, by LHW-HWT)
 * License: CC BY-NC-SA (educational use, non-commercial).
 *
 * The Arduboy2 drawing API is mapped onto the u8g2-js pixel-faithful canvas.
 * Arduboy bitmaps are horizontal (1 byte = 8 pixels of one row), which differs
 * from u8g2's vertical drawXBM format, so we blit them pixel-by-pixel.
 */
import { U8g2, U8g2Font } from '../../src/index.js';
import { u8g2_font_5x7_tf } from '../../fonts/u8g2_font_5x7_tf.js';
import {
  Man_L_1, Man_L_2, Man_L_3, Man_R_1, Man_R_2, Man_R_3, Man_U_1, Man_U_2, Man_U_3,
  Man_D_1, Man_D_2, Man_D_3, M_L, M_R, M_U, M_D, WALL_1, WALL_2, TNT_1, TNT_2,
  DOOR, LOVE, START_TITLE, TITLE_TNT, LHW, BOOM_1, BOOM_2, BOOM_3,
  Man_table, M_table, TNT_table, BOOM_table,
} from './bitmaps.gen.js';

/* ---------------- display ---------------- */
const VW = 128, VH = 64;
const canvas = document.getElementById('screen');
const u8g2 = new U8g2({ width: VW, height: VH, layout: 'vertical' });
const font = U8g2Font.fromBase64(u8g2_font_5x7_tf);
u8g2.setFont(font);
u8g2.attachCanvas(canvas, { scale: 4, pad: 0 });

/* Arduboy color 1 = white/on, 0 = black/off; canvas renderer: on=black, off=white. */
function setColor(c) { u8g2.setDrawColor(c === 1 ? 0 : 1); }
function fillRect(x, y, w, h, c) { setColor(c); u8g2.drawBox(x, y, w, h); u8g2.setDrawColor(1); }
function blit(x, y, w, h, bmp, c) {
  setColor(c);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const byte = bmp[(i >> 3) * h + j];
      if (byte & (1 << (i & 7))) u8g2.drawPixel(x + i, y + j);
    }
  }
  u8g2.setDrawColor(1);
}
let cursorX = 0, cursorY = 0;
function setCursor(x, y) { cursorX = x; cursorY = y; }
function println(s) {
  u8g2.setFont(font);
  u8g2.setDrawColor(0); /* white text on black */
  u8g2.drawUTF8(cursorX, cursorY + 6, s);
  cursorY += 8;
  u8g2.setDrawColor(1);
}
function clearBlack() { /* Arduboy clear() = black screen */
  u8g2.clearBuffer();
  u8g2.setDrawColor(1); u8g2.drawBox(0, 0, VW, VH); u8g2.setDrawColor(1);
}
const millis = () => performance.now();

/* ---------------- game state ---------------- */
let LIFE, LEVEL, KeyBack;
const MAP = Array.from({ length: 31 }, () => new Array(15).fill(0));
const monster = Array.from({ length: 10 }, () => [0, 0]);
const MLRUD = new Array(10).fill(255);
let PX, PY, PP, PS;
let PMove = false, BMove = true;
let CSX = 0, CSY = 0;
const SBDPL = [1, 2, 3];
const TntList = Array.from({ length: 10 }, () => [0, 0]);
let TNTN = 0;
const TntTime = new Array(10).fill(0);
let MMTime = 0, PIT = 0, TNTS = 0;
let PWIN = false;
const BOOMTime = 3000, MMTimeOut = 100, Invincible_Time = 5000;

let gameState = 'menu'; /* menu | about | level | play | fail | win */
let POA = false;
let waitUntil = 0;
let failPhase = 0, failWait = 0;

const rand = (a, b) => Math.floor(Math.random() * (b - a)) + a;

/* ---------------- input ---------------- */
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys.add(e.key);
});
window.addEventListener('keyup', (e) => keys.delete(e.key));
function key() {
  KeyBack = 255;
  if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) KeyBack = 0;
  if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) KeyBack = 1;
  if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) KeyBack = 2;
  if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) KeyBack = 3;
  if (keys.has('z') || keys.has('Z') || keys.has(' ')) KeyBack = 4;   /* A */
  if (keys.has('x') || keys.has('X')) KeyBack = 5;                     /* B */
}

/* ---------------- map / logic ---------------- */
function BuildMap() {
  LIFE = 3;
  let MN = 0;
  PP = 2;
  for (let n = 0; n < 10; n++) { TntTime[n] = 0; MLRUD[n] = 255; }
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 31; x++) {
      if (y === 0 || y === 14) MAP[x][y] = 1;
      else if (x === 0 || x === 30) MAP[x][y] = 1;
      else if (x % 2 === 0 && y % 2 === 0) MAP[x][y] = 1;
      else if (rand(0, 4) === 0) MAP[x][y] = 2;
      else if (rand(0, 28) === 0) {
        if (MN < LEVEL) { monster[MN][0] = x; monster[MN][1] = y; MLRUD[MN] = 2; MN++; }
      } else MAP[x][y] = 0;
    }
  }
  for (let py = 0; py < 3; py++)
    for (let px = 0; px < 3; px++)
      MAP[15 - 1 + px][7 - 1 + py] = 0;
  PX = 15; PY = 7;
  PIT = millis();
}

function SBDP(SBP, sx, sy) {
  BMove = true;
  let SX = 0, SY = 0;
  switch (SBP) {
    case 3: SX = -1; break; /* left */
    case 1: SX = 1; break;  /* right */
    case 0: SY = -1; break; /* up */
    case 2: SY = 1; break;  /* down */
  }
  for (const item of SBDPL)
    if (MAP[sx + SX][sy + SY] === item) BMove = false;
}

function logic() {
  if (LIFE > 0) {
    /* monster AI */
    if (millis() >= MMTime + MMTimeOut) {
      MMTime = millis();
      for (let n = 0; n < 10; n++) {
        if (MLRUD[n] !== 255) {
          SBDP(MLRUD[n], monster[n][0], monster[n][1]);
          if (BMove) {
            switch (MLRUD[n]) {
              case 0: monster[n][1]--; break;
              case 1: monster[n][0]++; break;
              case 2: monster[n][1]++; break;
              case 3: monster[n][0]--; break;
            }
          } else MLRUD[n] = rand(0, 4);
        }
      }
    }
    /* win check */
    PWIN = true;
    for (let n = 0; n < 10; n++) if (MLRUD[n] !== 255) PWIN = false;
    if (PWIN) {
      if (LEVEL === 10) gameState = 'win';
      else goLevel(LEVEL + 1);
      return;
    }
    /* player damage */
    for (let i = 0; i < 10; i++) {
      if (MAP[monster[i][0]][monster[i][1]] >= 4 && MLRUD[i] !== 255) MLRUD[i] = 255;
      if (millis() >= PIT + Invincible_Time) {
        if ((PX === monster[i][0] && PY === monster[i][1] && MLRUD[i] !== 255) || MAP[PX][PY] >= 4) {
          LIFE--;
          PIT = millis();
        }
      }
    }
    /* player movement */
    switch (KeyBack) {
      case 0:
        PP = 0; SBDP(PP, PX, PY);
        if (PY > 1 && BMove) PY--;
        break;
      case 1:
        PP = 2; SBDP(PP, PX, PY);
        if (PY < 13 && BMove) PY++;
        break;
      case 2:
        PP = 3; SBDP(PP, PX, PY);
        if (PX > 1 && BMove) PX--;
        break;
      case 3:
        PP = 1; SBDP(PP, PX, PY);
        if (PX < 29 && BMove) PX++;
        break;
      case 4:
        if (TNTN < 10 && MAP[PX][PY] !== 3) {
          TNTN++;
          TntList[TNTN - 1][0] = PX;
          TntList[TNTN - 1][1] = PY;
          MAP[PX][PY] = 3;
          TntTime[TNTN - 1] = millis();
        }
        break;
    }
    /* TNT explosion */
    if (TNTN !== 0 && millis() >= TntTime[0] + BOOMTime) {
      MAP[TntList[0][0]][TntList[0][1]] = 4;
      for (let BOOMx = 0; BOOMx < 3; BOOMx++)
        if (MAP[TntList[0][0] - 1 + BOOMx][TntList[0][1]] !== 1 &&
            MAP[TntList[0][0] - 1 + BOOMx][TntList[0][1]] !== 3)
          MAP[TntList[0][0] - 1 + BOOMx][TntList[0][1]] = 4;
      for (let BOOMy = 0; BOOMy < 3; BOOMy++)
        if (MAP[TntList[0][0]][TntList[0][1] - 1 + BOOMy] !== 1 &&
            MAP[TntList[0][0] - 1 + BOOMy][TntList[0][1]] !== 3)
          MAP[TntList[0][0]][TntList[0][1] - 1 + BOOMy] = 4;
      TNTN--;
      for (let TNTi = 0; TNTi < TNTN; TNTi++) {
        TntList[TNTi][0] = TntList[TNTi + 1][0];
        TntList[TNTi][1] = TntList[TNTi + 1][1];
        TntTime[TNTi] = TntTime[TNTi + 1];
      }
    }
  }
  /* explosion frame decay (also runs during fail) */
  for (let y = 0; y < 15; y++)
    for (let x = 0; x < 31; x++) {
      if (MAP[x][y] === 4) MAP[x][y] = 5;
      else if (MAP[x][y] === 5) MAP[x][y] = 6;
      else if (MAP[x][y] === 6) MAP[x][y] = 0;
    }
}

/* ---------------- drawing ---------------- */
function DrawMap() {
  fillRect(0, 0, 128, 64, 1); /* white bg */
  for (let y = PY - 4; y < PY + 5; y++) {
    for (let x = PX - 8; x < PX + 10; x++) {
      if (x >= 0 && y >= 0 && x <= 30 && y <= 14) {
        const sx = x * 8 - (PX - 15) * 8 - 64 + CSX;
        const sy = y * 8 - (PY - 7) * 8 - 32 + CSY;
        switch (MAP[x][y]) {
          case 1: blit(sx, sy, 8, 8, WALL_1, 0); break;
          case 2: blit(sx, sy, 8, 8, WALL_2, 0); break;
          case 3: blit(sx, sy, 8, 8, TNT_table[TNTS], 0); break;
          case 4: blit(sx, sy, 8, 8, BOOM_1, 0); break;
          case 5: blit(sx, sy, 8, 8, BOOM_2, 0); break;
          case 6: blit(sx, sy, 8, 8, BOOM_3, 0); break;
        }
      }
    }
  }
  TNTS++; if (TNTS >= 2) TNTS = 0;
}

function DrawEntity() {
  if (LIFE > 0) {
    for (let n = 0; n < 10; n++)
      if (MLRUD[n] !== 255)
        blit(monster[n][0] * 8 - (PX - 15) * 8 - 64 + CSX, monster[n][1] * 8 - (PY - 7) * 8 - 32 + CSY, 8, 8, M_table[MLRUD[n]], 0);
    if (millis() >= PIT + Invincible_Time) {
      blit(56, 24, 8, 8, Man_table[PP * 3 + PS], 0);
    } else if (PS === 0) {
      blit(56, 24, 8, 8, Man_table[PP * 3 + PS], 0);
    }
    if (PMove === true || millis() < PIT + Invincible_Time) {
      PS++; if (PS > 2) PS = 0;
    } else PS = 0;
  }
}

function Draw() {
  DrawMap();
  DrawEntity();
  fillRect(0, 56, 128, 8, 0); /* black bar */
  for (let ni = 0; ni < LIFE; ni++) blit(ni * 9, 56, 8, 8, LOVE, 1);
  u8g2.sendBuffer();
}

/* ---------------- states ---------------- */
function startGame() { goLevel(1); }
function goLevel(n) { LEVEL = n; gameState = 'level'; waitUntil = millis() + 1000; }
function startFail() {
  gameState = 'fail'; failPhase = 0; failWait = millis() + 500;
  for (let y = 0; y < 15; y++) for (let x = 0; x < 31; x++) MAP[x][y] = 4;
}
function resetGame() { gameState = 'menu'; POA = false; }

function menuFrame() {
  key();
  switch (KeyBack) {
    case 0: POA = false; break;
    case 1: POA = true; break;
    case 4: if (POA) gameState = 'about'; else startGame(); break;
  }
  clearBlack();
  blit(39, 1, 87, 39, START_TITLE, 1);
  blit(0, 23, 37, 41, TITLE_TNT, 1);
  blit(65, 58, 39, 5, LHW, 1);
  setCursor(70, 39); println('PLAY');
  setCursor(70, 47); println('ABOUT');
  setCursor(62, POA ? 47 : 39); println('*');
  u8g2.sendBuffer();
}

function aboutFrame() {
  key();
  if (KeyBack !== 255) gameState = 'menu';
  clearBlack();
  setCursor(0, 0);
  println(' >About');
  println('');
  println('LHW programming');
  println('LHW Art');
  println('E-mail');
  println('1281702594@qq.com');
  println('');
  println('Any key back...');
  u8g2.sendBuffer();
}

function levelFrame() {
  clearBlack();
  setCursor(52, 16); println('LEVEL');
  setCursor(64, 32); println(String(LEVEL));
  u8g2.sendBuffer();
  if (millis() >= waitUntil) { BuildMap(); gameState = 'play'; }
}

function playFrame() {
  if (LIFE === 0) { startFail(); return; }
  key();
  Draw();
  logic();
}

function failFrame() {
  if (failPhase === 0) {
    if (millis() >= failWait) { logic(); Draw(); failWait = millis() + 500; }
    if (MAP[0][0] < 3) { failPhase = 1; failWait = millis() + 5000; }
  } else {
    Draw();
    blit(56, 24, 8, 8, Man_table[3], 0);
    u8g2.sendBuffer();
    if (millis() >= failWait) resetGame();
  }
}

function winFrame() {
  key();
  if (KeyBack !== 255) { resetGame(); return; }
  clearBlack();
  setCursor(16, 0);
  println('CONGRATULATIONS');
  println(' BOMBER MAN BECOMES');
  println('       RUNNER');
  println('SEE YOU AGAIN IN LODE');
  println('       RUNNER');
  blit(56, 48, 8, 8, Man_table[3], 1);
  fillRect(0, 56, 128, 8, 1);
  for (let x = 0; x < 128; x += 8) blit(x, 56, 8, 8, WALL_2, 0);
  u8g2.sendBuffer();
}

/* ---------------- main loop ---------------- */
function frame() {
  switch (gameState) {
    case 'menu': menuFrame(); break;
    case 'about': aboutFrame(); break;
    case 'level': levelFrame(); break;
    case 'play': playFrame(); break;
    case 'fail': failFrame(); break;
    case 'win': winFrame(); break;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* test hooks for tools/check-bomberman.js */
window.__bomberman = {
  gameState: () => gameState,
  press: (k) => keys.add(k),
  release: (k) => keys.delete(k),
  pos: () => [PX, PY],
  life: () => LIFE,
};
