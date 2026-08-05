/**
 * draw.js
 *
 * Drawing primitives.  Faithful ports of u8g2_box.c, u8g2_line.c,
 * u8g2_circle.c, u8g2_arc.c, u8g2_polygon.c, u8g2_bitmap.c and
 * u8g2_button.c.  Every function takes the U8g2 instance as the first
 * argument (mirroring the C `u8g2_t *u8g2`).
 *
 * These are installed as methods on U8g2 by installDrawFunctions().
 */

/* ---------------- U8G2_DRAW_* / U8G2_BTN_* constants ------------ */
export const U8G2_DRAW_UPPER_RIGHT = 0x01;
export const U8G2_DRAW_UPPER_LEFT = 0x02;
export const U8G2_DRAW_LOWER_RIGHT = 0x04;
export const U8G2_DRAW_LOWER_LEFT = 0x08;
export const U8G2_DRAW_ALL = 0x0f;

export const U8G2_BTN_BW_MASK = 7;
export const U8G2_BTN_BW1 = 0x01;
export const U8G2_BTN_BW2 = 0x02;
export const U8G2_BTN_BW3 = 0x03;
export const U8G2_BTN_SHADOW_POS = 3;
export const U8G2_BTN_SHADOW_MASK = 0x18;
export const U8G2_BTN_SHADOW0 = 0x08;
export const U8G2_BTN_SHADOW1 = 0x10;
export const U8G2_BTN_SHADOW2 = 0x18;
export const U8G2_BTN_INV = 0x20;
export const U8G2_BTN_HCENTER = 0x40;
export const U8G2_BTN_XFRAME = 0x80;

/* =================================================================== */
/* Box                                                                 */

export function drawBox(u8g2, x, y, w, h) {
  if (!u8g2.isIntersection(x, y, x + w, y + h)) return;
  while (h !== 0) {
    u8g2.drawHVLine(x, y, w, 0);
    y++;
    h--;
  }
}

export function drawFrame(u8g2, x, y, w, h) {
  const xtmp = x;
  if (!u8g2.isIntersection(x, y, x + w, y + h)) return;
  u8g2.drawHVLine(x, y, w, 0);
  if (h >= 2) {
    h -= 2;
    y++;
    if (h > 0) {
      u8g2.drawHVLine(x, y, h, 1);
      x += w;
      x--;
      u8g2.drawHVLine(x, y, h, 1);
      y += h;
    }
    u8g2.drawHVLine(xtmp, y, w, 0);
  }
}

export function drawRBox(u8g2, x, y, w, h, r) {
  if (!u8g2.isIntersection(x, y, x + w, y + h)) return;

  const xl = x + r;
  const yu = y + r;
  const xr = x + w - r - 1;
  const yl = y + h - r - 1;

  drawDisc(u8g2, xl, yu, r, U8G2_DRAW_UPPER_LEFT);
  drawDisc(u8g2, xr, yu, r, U8G2_DRAW_UPPER_RIGHT);
  drawDisc(u8g2, xl, yl, r, U8G2_DRAW_LOWER_LEFT);
  drawDisc(u8g2, xr, yl, r, U8G2_DRAW_LOWER_RIGHT);

  let ww = w - r - r;
  let hh;
  if (ww >= 3) {
    ww -= 2;
    drawBox(u8g2, xl + 1, y, ww, r + 1);
    drawBox(u8g2, xl + 1, yl, ww, r + 1);
  }
  hh = h - r - r;
  if (hh >= 3) {
    hh -= 2;
    drawBox(u8g2, x, yu + 1, w, hh);
  }
}

export function drawRFrame(u8g2, x, y, w, h, r) {
  if (!u8g2.isIntersection(x, y, x + w, y + h)) return;

  const xl = x + r;
  const yu = y + r;
  const xr = x + w - r - 1;
  const yl = y + h - r - 1;

  drawCircle(u8g2, xl, yu, r, U8G2_DRAW_UPPER_LEFT);
  drawCircle(u8g2, xr, yu, r, U8G2_DRAW_UPPER_RIGHT);
  drawCircle(u8g2, xl, yl, r, U8G2_DRAW_LOWER_LEFT);
  drawCircle(u8g2, xr, yl, r, U8G2_DRAW_LOWER_RIGHT);

  let ww = w - r - r;
  let hh = h - r - r;
  if (ww >= 3) {
    ww -= 2;
    h--;
    u8g2.drawHLine(xl + 1, y, ww);
    u8g2.drawHLine(xl + 1, y + h, ww);
  }
  if (hh >= 3) {
    hh -= 2;
    w--;
    u8g2.drawVLine(x, yu + 1, hh);
    u8g2.drawVLine(x + w, yu + 1, hh);
  }
}

/* =================================================================== */
/* Line (Bresenham)                                                    */

export function drawLine(u8g2, x1, y1, x2, y2) {
  let tmp;
  let x, y;
  let dx, dy;
  let err, ystep;
  let swapxy = 0;

  dx = x1 > x2 ? x1 - x2 : x2 - x1;
  dy = y1 > y2 ? y1 - y2 : y2 - y1;

  if (dy > dx) {
    swapxy = 1;
    tmp = dx; dx = dy; dy = tmp;
    tmp = x1; x1 = y1; y1 = tmp;
    tmp = x2; x2 = y2; y2 = tmp;
  }
  if (x1 > x2) {
    tmp = x1; x1 = x2; x2 = tmp;
    tmp = y1; y1 = y2; y2 = tmp;
  }
  err = dx >> 1;
  ystep = y2 > y1 ? 1 : -1;
  y = y1;

  /* the original clamps x2==0xffff for the 16-bit build; with JS numbers
     the <= loop already handles the end point, keep it simple */

  for (x = x1; x <= x2; x++) {
    if (swapxy === 0) u8g2.drawPixel(x, y);
    else u8g2.drawPixel(y, x);
    err -= dy;
    if (err < 0) {
      y += ystep;
      err += dx;
    }
  }
}

/* =================================================================== */
/* Circle / Disc                                                       */

function drawCircleSection(u8g2, x, y, x0, y0, option) {
  if (option & U8G2_DRAW_UPPER_RIGHT) {
    u8g2.drawPixel(x0 + x, y0 - y);
    u8g2.drawPixel(x0 + y, y0 - x);
  }
  if (option & U8G2_DRAW_UPPER_LEFT) {
    u8g2.drawPixel(x0 - x, y0 - y);
    u8g2.drawPixel(x0 - y, y0 - x);
  }
  if (option & U8G2_DRAW_LOWER_RIGHT) {
    u8g2.drawPixel(x0 + x, y0 + y);
    u8g2.drawPixel(x0 + y, y0 + x);
  }
  if (option & U8G2_DRAW_LOWER_LEFT) {
    u8g2.drawPixel(x0 - x, y0 + y);
    u8g2.drawPixel(x0 - y, y0 + x);
  }
}

function drawCircleInner(u8g2, x0, y0, rad, option) {
  let f = 1 - rad;
  let ddF_x = 1;
  let ddF_y = -2 * rad;
  let x = 0;
  let y = rad;

  drawCircleSection(u8g2, x, y, x0, y0, option);

  while (x < y) {
    if (f >= 0) {
      y--;
      ddF_y += 2;
      f += ddF_y;
    }
    x++;
    ddF_x += 2;
    f += ddF_x;
    drawCircleSection(u8g2, x, y, x0, y0, option);
  }
}

export function drawCircle(u8g2, x0, y0, rad, option) {
  if (!u8g2.isIntersection(x0 - rad, y0 - rad, x0 + rad + 1, y0 + rad + 1)) return;
  drawCircleInner(u8g2, x0, y0, rad, option);
}

function drawDiscSection(u8g2, x, y, x0, y0, option) {
  if (option & U8G2_DRAW_UPPER_RIGHT) {
    u8g2.drawVLine(x0 + x, y0 - y, y + 1);
    u8g2.drawVLine(x0 + y, y0 - x, x + 1);
  }
  if (option & U8G2_DRAW_UPPER_LEFT) {
    u8g2.drawVLine(x0 - x, y0 - y, y + 1);
    u8g2.drawVLine(x0 - y, y0 - x, x + 1);
  }
  if (option & U8G2_DRAW_LOWER_RIGHT) {
    u8g2.drawVLine(x0 + x, y0, y + 1);
    u8g2.drawVLine(x0 + y, y0, x + 1);
  }
  if (option & U8G2_DRAW_LOWER_LEFT) {
    u8g2.drawVLine(x0 - x, y0, y + 1);
    u8g2.drawVLine(x0 - y, y0, x + 1);
  }
}

function drawDiscInner(u8g2, x0, y0, rad, option) {
  let f = 1 - rad;
  let ddF_x = 1;
  let ddF_y = -2 * rad;
  let x = 0;
  let y = rad;

  drawDiscSection(u8g2, x, y, x0, y0, option);

  while (x < y) {
    if (f >= 0) {
      y--;
      ddF_y += 2;
      f += ddF_y;
    }
    x++;
    ddF_x += 2;
    f += ddF_x;
    drawDiscSection(u8g2, x, y, x0, y0, option);
  }
}

export function drawDisc(u8g2, x0, y0, rad, option) {
  if (!u8g2.isIntersection(x0 - rad, y0 - rad, x0 + rad + 1, y0 + rad + 1)) return;
  drawDiscInner(u8g2, x0, y0, rad, option);
}

/* =================================================================== */
/* Ellipse (Foley, p90)                                                */

function drawEllipseSection(u8g2, x, y, x0, y0, option) {
  if (option & U8G2_DRAW_UPPER_RIGHT) u8g2.drawPixel(x0 + x, y0 - y);
  if (option & U8G2_DRAW_UPPER_LEFT) u8g2.drawPixel(x0 - x, y0 - y);
  if (option & U8G2_DRAW_LOWER_RIGHT) u8g2.drawPixel(x0 + x, y0 + y);
  if (option & U8G2_DRAW_LOWER_LEFT) u8g2.drawPixel(x0 - x, y0 + y);
}

function drawEllipseInner(u8g2, x0, y0, rx, ry, option) {
  let x, y;
  let xchg, ychg, err, rxrx2, ryry2, stopx, stopy;

  rxrx2 = 2 * rx * rx;
  ryry2 = 2 * ry * ry;

  x = rx;
  y = 0;

  xchg = (1 - 2 * rx) * ry * ry;
  ychg = rx * rx;
  err = 0;
  stopx = ryry2 * rx;
  stopy = 0;

  while (stopx >= stopy) {
    drawEllipseSection(u8g2, x, y, x0, y0, option);
    y++;
    stopy += rxrx2;
    err += ychg;
    ychg += rxrx2;
    if (2 * err + xchg > 0) {
      x--;
      stopx -= ryry2;
      err += xchg;
      xchg += ryry2;
    }
  }

  x = 0;
  y = ry;

  xchg = ry * ry;
  ychg = (1 - 2 * ry) * rx * rx;
  err = 0;
  stopx = 0;
  stopy = rxrx2 * ry;

  while (stopx <= stopy) {
    drawEllipseSection(u8g2, x, y, x0, y0, option);
    x++;
    stopx += ryry2;
    err += xchg;
    xchg += ryry2;
    if (2 * err + ychg > 0) {
      y--;
      stopy -= rxrx2;
      err += ychg;
      ychg += rxrx2;
    }
  }
}

export function drawEllipse(u8g2, x0, y0, rx, ry, option) {
  if (!u8g2.isIntersection(x0 - rx, y0 - ry, x0 + rx + 1, y0 + ry + 1)) return;
  drawEllipseInner(u8g2, x0, y0, rx, ry, option);
}

function drawFilledEllipseSection(u8g2, x, y, x0, y0, option) {
  if (option & U8G2_DRAW_UPPER_RIGHT) u8g2.drawVLine(x0 + x, y0 - y, y + 1);
  if (option & U8G2_DRAW_UPPER_LEFT) u8g2.drawVLine(x0 - x, y0 - y, y + 1);
  if (option & U8G2_DRAW_LOWER_RIGHT) u8g2.drawVLine(x0 + x, y0, y + 1);
  if (option & U8G2_DRAW_LOWER_LEFT) u8g2.drawVLine(x0 - x, y0, y + 1);
}

function drawFilledEllipseInner(u8g2, x0, y0, rx, ry, option) {
  let x, y;
  let xchg, ychg, err, rxrx2, ryry2, stopx, stopy;

  rxrx2 = 2 * rx * rx;
  ryry2 = 2 * ry * ry;

  x = rx;
  y = 0;

  xchg = (1 - 2 * rx) * ry * ry;
  ychg = rx * rx;
  err = 0;
  stopx = ryry2 * rx;
  stopy = 0;

  while (stopx >= stopy) {
    drawFilledEllipseSection(u8g2, x, y, x0, y0, option);
    y++;
    stopy += rxrx2;
    err += ychg;
    ychg += rxrx2;
    if (2 * err + xchg > 0) {
      x--;
      stopx -= ryry2;
      err += xchg;
      xchg += ryry2;
    }
  }

  x = 0;
  y = ry;

  xchg = ry * ry;
  ychg = (1 - 2 * ry) * rx * rx;
  err = 0;
  stopx = 0;
  stopy = rxrx2 * ry;

  while (stopx <= stopy) {
    drawFilledEllipseSection(u8g2, x, y, x0, y0, option);
    x++;
    stopx += ryry2;
    err += xchg;
    xchg += ryry2;
    if (2 * err + ychg > 0) {
      y--;
      stopy -= rxrx2;
      err += ychg;
      ychg += rxrx2;
    }
  }
}

export function drawFilledEllipse(u8g2, x0, y0, rx, ry, option) {
  if (!u8g2.isIntersection(x0 - rx, y0 - ry, x0 + rx + 1, y0 + ry + 1)) return;
  drawFilledEllipseInner(u8g2, x0, y0, rx, ry, option);
}

/* =================================================================== */
/* Arc (Andres circle algorithm)                                       */

function drawArcInner(u8g2, x0, y0, rad, start, end) {
  const full = start === end;
  const inverted = start > end;
  const a_start = inverted ? end : start;
  const a_end = inverted ? start : end;

  let x = 0;
  let y = rad;
  let d = rad - 1;

  while (y >= x) {
    let ratio = y === 0 ? 0 : Math.trunc((x * 255) / y);
    ratio = Math.trunc((ratio * (770195 - (ratio - 255) * (ratio + 941))) / 6137491);

    if (full || ((ratio >= a_start && ratio < a_end) !== inverted)) u8g2.drawPixel(x0 + y, y0 - x);
    if (full || ((ratio + a_end > 63 && ratio + a_start <= 63) !== inverted)) u8g2.drawPixel(x0 + x, y0 - y);
    if (full || ((ratio + 64 >= a_start && ratio + 64 < a_end) !== inverted)) u8g2.drawPixel(x0 - x, y0 - y);
    if (full || ((ratio + a_end > 127 && ratio + a_start <= 127) !== inverted)) u8g2.drawPixel(x0 - y, y0 - x);
    if (full || ((ratio + 128 >= a_start && ratio + 128 < a_end) !== inverted)) u8g2.drawPixel(x0 - y, y0 + x);
    if (full || ((ratio + a_end > 191 && ratio + a_start <= 191) !== inverted)) u8g2.drawPixel(x0 - x, y0 + y);
    if (full || ((ratio + 192 >= a_start && ratio + 192 < a_end) !== inverted)) u8g2.drawPixel(x0 + x, y0 + y);
    if (full || ((ratio + a_end > 255 && ratio + a_start <= 255) !== inverted)) u8g2.drawPixel(x0 + y, y0 + x);

    if (d >= 2 * x) {
      d = d - 2 * x - 1;
      x = x + 1;
    } else if (d < 2 * (rad - y)) {
      d = d + 2 * y - 1;
      y = y - 1;
    } else {
      d = d + 2 * (y - x - 1);
      y = y - 1;
      x = x + 1;
    }
  }
}

export function drawArc(u8g2, x0, y0, rad, start, end) {
  if (!u8g2.isIntersection(x0 - rad, y0 - rad, x0 + rad + 1, y0 + rad + 1)) return;
  drawArcInner(u8g2, x0, y0, rad, start, end);
}

/* =================================================================== */
/* Polygon / Triangle (scanline, max 6 points)                         */

const PG_MAX_POINTS = 6;
const PG_LEFT = 0;
const PG_RIGHT = 1;

export function newPolygonState() {
  return {
    list: Array.from({ length: PG_MAX_POINTS }, () => ({ x: 0, y: 0 })),
    cnt: 0,
    is_min_y_not_flat: 0,
    total_scan_line_cnt: 0,
    pge: [
      { x_direction: 1, height: 0, current_x_offset: 0, error_offset: 0, current_y: 0, max_y: 0, current_x: 0, error: 0, next_idx_fn: null, curr_idx: 0 },
      { x_direction: 1, height: 0, current_x_offset: 0, error_offset: 0, current_y: 0, max_y: 0, current_x: 0, error: 0, next_idx_fn: null, curr_idx: 0 },
    ],
  };
}

function pgeNext(pge) {
  if (pge.current_y >= pge.max_y) return 0;
  pge.current_x += pge.current_x_offset;
  pge.error += pge.error_offset;
  if (pge.error > 0) {
    pge.current_x += pge.x_direction;
    pge.error -= pge.height;
  }
  pge.current_y++;
  return 1;
}

function pgeInit(pge, x1, y1, x2, y2) {
  const dx = x2 - x1;
  let width;

  pge.height = y2 - y1;
  pge.max_y = y2;
  pge.current_y = y1;
  pge.current_x = x1;

  if (pge.height <= 0) {
    /* degenerate edge (flat / reversed): make it finish immediately
       (defensive; the C code would divide by zero here) */
    pge.current_y = pge.max_y;
    pge.current_x_offset = 0;
    pge.error_offset = 0;
    return;
  }

  if (dx >= 0) {
    pge.x_direction = 1;
    width = dx;
    pge.error = 0;
  } else {
    pge.x_direction = -1;
    width = -dx;
    pge.error = 1 - pge.height;
  }

  pge.current_x_offset = Math.trunc(dx / pge.height);
  pge.error_offset = width % pge.height;
}

function pgInc(pg, i) {
  i++;
  if (i >= pg.cnt) i = 0;
  return i;
}

function pgDec(pg, i) {
  i--;
  if (i >= pg.cnt) i = pg.cnt - 1;
  return i;
}

function pgExpandMinY(pg, min_y, pgeIdx) {
  let i = pg.pge[pgeIdx].curr_idx;
  for (;;) {
    i = pg.pge[pgeIdx].next_idx_fn(pg, i);
    if (pg.list[i].y !== min_y) break;
    pg.pge[pgeIdx].curr_idx = i;
  }
}

function pgPrepare(pg) {
  let max_y, min_y;
  let i;

  pg.pge[PG_RIGHT].next_idx_fn = pgInc;
  pg.pge[PG_LEFT].next_idx_fn = pgDec;

  max_y = pg.list[0].y;
  min_y = pg.list[0].y;
  pg.pge[PG_LEFT].curr_idx = 0;
  for (i = 1; i < pg.cnt; i++) {
    if (max_y < pg.list[i].y) max_y = pg.list[i].y;
    if (min_y > pg.list[i].y) {
      pg.pge[PG_LEFT].curr_idx = i;
      min_y = pg.list[i].y;
    }
  }

  pg.total_scan_line_cnt = max_y - min_y;
  if (pg.total_scan_line_cnt === 0) return 0;

  pg.pge[PG_RIGHT].curr_idx = pg.pge[PG_LEFT].curr_idx;
  pgExpandMinY(pg, min_y, PG_RIGHT);
  pgExpandMinY(pg, min_y, PG_LEFT);

  pg.is_min_y_not_flat = 1;
  if (pg.list[pg.pge[PG_LEFT].curr_idx].x !== pg.list[pg.pge[PG_RIGHT].curr_idx].x) {
    pg.is_min_y_not_flat = 0;
  } else {
    pg.total_scan_line_cnt--;
    if (pg.total_scan_line_cnt === 0) return 0;
  }

  return 1;
}

function pgHLine(pg, u8g2) {
  let x1 = pg.pge[PG_LEFT].current_x;
  let x2 = pg.pge[PG_RIGHT].current_x;
  const y = pg.pge[PG_RIGHT].current_y;
  const dw = u8g2.getDisplayWidth();
  const dh = u8g2.getDisplayHeight();

  if (y < 0) return;
  if (y >= dh) return;
  if (x1 < x2) {
    if (x2 < 0) return;
    if (x1 >= dw) return;
    if (x1 < 0) x1 = 0;
    if (x2 >= dw) x2 = dw;
    u8g2.drawHLine(x1, y, x2 - x1);
  } else {
    if (x1 < 0) return;
    if (x2 >= dw) return;
    if (x2 < 0) x1 = 0;
    if (x1 >= dw) x1 = dw;
    u8g2.drawHLine(x2, y, x1 - x2);
  }
}

function pgLineInit(pg, pgeIndex) {
  const pge = pg.pge[pgeIndex];
  let idx = pge.curr_idx;
  const y1 = pg.list[idx].y;
  const x1 = pg.list[idx].x;
  idx = pge.next_idx_fn(pg, idx);
  const y2 = pg.list[idx].y;
  const x2 = pg.list[idx].x;
  pge.curr_idx = idx;
  pgeInit(pge, x1, y1, x2, y2);
}

function pgExec(pg, u8g2) {
  let i = pg.total_scan_line_cnt;

  pgLineInit(pg, PG_LEFT);
  pgLineInit(pg, PG_RIGHT);

  if (pg.is_min_y_not_flat !== 0) {
    pgeNext(pg.pge[PG_LEFT]);
    pgeNext(pg.pge[PG_RIGHT]);
  }

  do {
    pgHLine(pg, u8g2);
    while (pgeNext(pg.pge[PG_LEFT]) === 0) pgLineInit(pg, PG_LEFT);
    while (pgeNext(pg.pge[PG_RIGHT]) === 0) pgLineInit(pg, PG_RIGHT);
    i--;
  } while (i > 0);
}

function pgDrawPolygon(pg, u8g2) {
  if (pgPrepare(pg) === 0) return;
  pgExec(pg, u8g2);
}

export function clearPolygonXY(u8g2) {
  u8g2.polygon.cnt = 0;
}

export function addPolygonXY(u8g2, x, y) {
  if (u8g2.polygon.cnt < PG_MAX_POINTS) {
    u8g2.polygon.list[u8g2.polygon.cnt].x = x;
    u8g2.polygon.list[u8g2.polygon.cnt].y = y;
    u8g2.polygon.cnt++;
  }
}

export function drawPolygon(u8g2) {
  pgDrawPolygon(u8g2.polygon, u8g2);
}

export function drawTriangle(u8g2, x0, y0, x1, y1, x2, y2) {
  clearPolygonXY(u8g2);
  addPolygonXY(u8g2, x0, y0);
  addPolygonXY(u8g2, x1, y1);
  addPolygonXY(u8g2, x2, y2);
  drawPolygon(u8g2);
}

/* =================================================================== */
/* Bitmaps                                                             */

export function setBitmapMode(u8g2, isTransparent) {
  u8g2.bitmapTransparency = isTransparent;
}

export function drawHorizontalBitmap(u8g2, x, y, len, b) {
  let mask;
  const color = u8g2.drawColor;
  const ncolor = color === 0 ? 1 : 0;

  if (!u8g2.isIntersection(x, y, x + len, y + 1)) return;

  mask = 128;
  while (len > 0) {
    if (b[0] & mask) {
      u8g2.drawColor = color;
      u8g2.drawHVLine(x, y, 1, 0);
    } else if (u8g2.bitmapTransparency === 0) {
      u8g2.drawColor = ncolor;
      u8g2.drawHVLine(x, y, 1, 0);
    }
    x++;
    mask >>= 1;
    if (mask === 0) {
      mask = 128;
      b = b.subarray(1);
    }
    len--;
  }
  u8g2.drawColor = color;
}

export function drawBitmap(u8g2, x, y, cnt, h, bitmap) {
  const w = cnt * 8;
  if (!u8g2.isIntersection(x, y, x + w, y + h)) return;
  while (h > 0) {
    drawHorizontalBitmap(u8g2, x, y, w, bitmap);
    bitmap = bitmap.subarray(cnt);
    y++;
    h--;
  }
}

export function drawHXBM(u8g2, x, y, len, b) {
  let mask;
  const color = u8g2.drawColor;
  const ncolor = color === 0 ? 1 : 0;
  if (!u8g2.isIntersection(x, y, x + len, y + 1)) return;

  mask = 1;
  while (len > 0) {
    const currentBit = b[0] & mask;
    let runLength = 0;
    while (len > 0 && (currentBit === 0 ? (b[0] & mask) === 0 : (b[0] & mask) !== 0)) {
      runLength++;
      x++;
      mask <<= 1;
      if (mask === 0) {
        mask = 1;
        b = b.subarray(1);
      }
      len--;
    }
    if (currentBit) {
      u8g2.drawColor = color;
      u8g2.drawHVLine(x - runLength, y, runLength, 0);
    } else if (u8g2.bitmapTransparency === 0) {
      u8g2.drawColor = ncolor;
      u8g2.drawHVLine(x - runLength, y, runLength, 0);
    }
  }
  u8g2.drawColor = color;
}

export function drawXBM(u8g2, x, y, w, h, bitmap) {
  const blen = (w + 7) >> 3;
  if (!u8g2.isIntersection(x, y, x + w, y + h)) return;
  while (h > 0) {
    drawHXBM(u8g2, x, y, w, bitmap);
    bitmap = bitmap.subarray(blen);
    y++;
    h--;
  }
}

/* XBMP variants read from "program memory"; in JS both are plain arrays,
   so they are identical to the XBM versions.  Kept for API parity. */
export const drawHXBMP = drawHXBM;
export const drawXBMP = drawXBM;

/* =================================================================== */
/* Buttons                                                             */

export function drawButtonFrame(u8g2, x, y, flags, textWidth, paddingH, paddingV) {
  let w = textWidth;
  let xx, yy, ww, hh;
  const gapFrame = U8G2_BTN_BW_MASK + 1;
  let borderWidth = flags & U8G2_BTN_BW_MASK;

  const a = u8g2.getAscent();
  const d = u8g2.getDescent();
  const colorBackup = u8g2.drawColor;

  if (flags & U8G2_BTN_XFRAME) {
    borderWidth++;
    gapFrame = borderWidth;
    borderWidth++;
  }

  for (;;) {
    xx = x - paddingH - borderWidth;
    ww = w + 2 * paddingH + 2 * borderWidth;

    yy = y + u8g2.fontCalcVref() - a - paddingV - borderWidth;
    hh = a - d + 2 * paddingV + 2 * borderWidth;
    if (borderWidth === 0) break;
    if (borderWidth === gapFrame) {
      u8g2.setDrawColor(colorBackup === 0 ? 1 : 0);
    }
    drawFrame(u8g2, xx, yy, ww, hh);
    u8g2.setDrawColor(colorBackup);

    if (flags & U8G2_BTN_SHADOW_MASK) {
      if (borderWidth === (flags & U8G2_BTN_BW_MASK)) {
        const shadowGap = ((flags & U8G2_BTN_SHADOW_MASK) >> U8G2_BTN_SHADOW_POS) - 1;
        for (let i = 0; i < borderWidth; i++) {
          u8g2.drawHLine(xx + borderWidth + shadowGap, yy + hh + i + shadowGap, ww);
          u8g2.drawVLine(xx + ww + i + shadowGap, yy + borderWidth + shadowGap, hh);
        }
      }
    }
    borderWidth--;
  }

  if (flags & U8G2_BTN_INV) {
    u8g2.setDrawColor(2); /* XOR */
    drawBox(u8g2, xx, yy, ww, hh);
    u8g2.setDrawColor(colorBackup);
  }
}

export function drawButtonUTF8(u8g2, x, y, flags, width, paddingH, paddingV, text) {
  let w = u8g2.getUTF8Width(text);
  let textXOffset = 0;

  if (flags & U8G2_BTN_HCENTER) x -= (w + 1) >> 1;

  if (w < width) {
    if (flags & U8G2_BTN_HCENTER) textXOffset = (width - w) >> 1;
    w = width;
  }

  u8g2.setFontMode(1);
  u8g2.drawUTF8(x, y, text);
  drawButtonFrame(u8g2, x - textXOffset, y, flags, w, paddingH, paddingV);
}

/* =================================================================== */

export function installDrawFunctions(cls) {
  const methods = {
    drawBox,
    drawFrame,
    drawRBox,
    drawRFrame,
    drawLine,
    drawCircle,
    drawDisc,
    drawEllipse,
    drawFilledEllipse,
    drawArc,
    clearPolygonXY,
    addPolygonXY,
    drawPolygon,
    drawTriangle,
    setBitmapMode,
    drawHorizontalBitmap,
    drawBitmap,
    drawHXBM,
    drawXBM,
    drawHXBMP,
    drawXBMP,
    drawButtonFrame,
    drawButtonUTF8,
  };
  for (const [name, fn] of Object.entries(methods)) {
    cls.prototype[name] = function (...args) { return fn(this, ...args); };
  }
}
