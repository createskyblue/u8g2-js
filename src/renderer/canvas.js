/**
 * canvas.js
 *
 * Renders the U8g2 display memory onto an HTML5 <canvas>.
 *
 * The display memory is stored in the native controller layout
 * (tileWidth*8 x tileHeight*8).  The visible panel is pixelWidth x pixelHeight.
 * u8g2 rotation + flip mode describe how the physical panel is mounted, so
 * this renderer presents the buffer the way a user looking at the device
 * would see it: the mount rotation (and flip) are applied here, while the
 * drawing engine already used the same rotation inside draw_l90 to keep the
 * user coordinate system upright.
 *
 * Options: scale, showGrid, pad, background, onColor, offColor, bezel.
 */

const DEFAULTS = {
  scale: null,          /* pixels per display pixel; null = auto fit to 800 */
  showGrid: false,
  pad: 18,              /* margin around the panel inside the canvas */
  background: '#3a3f4a',
  onColor: '#111318',   /* "lit" pixel */
  offColor: '#d8e0d0',  /* "unlit" pixel */
  bezel: true,          /* draw a thin bezel line around the panel */
  bezelColor: '#20242c',
};

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

export function createCanvasRenderer(canvas, options = {}) {
  const o = Object.assign({}, DEFAULTS, options);
  const ctx = canvas.getContext('2d');

  let geom = null; /* { OW, OH, NW, NH, x0, eff } */

  function compute(u8g2) {
    const di = u8g2.displayInfo;
    const NW = di.tileWidth * 8;
    const NH = di.tileHeight * 8;
    const x0 = NW > di.pixelWidth
      ? (u8g2.flipMode ? di.flipXOffset : di.defaultXOffset)
      : 0;
    const viewW = di.pixelWidth;
    const viewH = di.pixelHeight;
    const eff = (u8g2.rotation + (u8g2.flipMode ? 2 : 0)) & 3;
    const swap = eff === 1 || eff === 3;
    return {
      NW, NH, x0, viewW, viewH, eff,
      OW: swap ? viewH : viewW,
      OH: swap ? viewW : viewH,
    };
  }

  function readNative(u8g2, x, y) {
    const di = u8g2.displayInfo;
    const mem = u8g2.displayMemory;
    if (x < 0 || y < 0 || x >= di.tileWidth * 8 || y >= di.tileHeight * 8) return 0;
    if (di.layout === 'horizontal') {
      return (mem[y * di.tileWidth + (x >> 3)] & (128 >> (x & 7))) ? 1 : 0;
    }
    return (mem[(y & ~7) * di.tileWidth + x] >> (y & 7)) & 1;
  }

  function viewToNative(g, vx, vy) {
    const { NW, NH, x0, eff } = g;
    let bx, by;
    switch (eff) {
      case 1: bx = NW - 1 - vy; by = vx; break;            /* 90 deg CW */
      case 2: bx = NW - 1 - vx; by = NH - 1 - vy; break;   /* 180 deg */
      case 3: bx = vy; by = NH - 1 - vx; break;            /* 270 deg CW */
      default: bx = vx; by = vy; break;
    }
    return { x: x0 + bx, y: by };
  }

  function paint(u8g2) {
    const g = (geom = compute(u8g2));
    const scale = o.scale || Math.max(1, Math.floor(800 / Math.max(g.OW, g.OH)));
    const W = g.OW * scale + o.pad * 2;
    const H = g.OH * scale + o.pad * 2;

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    /* background + bezel */
    ctx.fillStyle = o.background;
    ctx.fillRect(0, 0, W, H);
    if (o.bezel) {
      ctx.strokeStyle = o.bezelColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(o.pad - 1, o.pad - 1, g.OW * scale + 2, g.OH * scale + 2);
    }

    /* build the pixel image */
    const img = ctx.createImageData(g.OW, g.OH);
    const data = img.data;
    const [onR, onG, onB] = hexToRgb(o.onColor);
    const [offR, offG, offB] = hexToRgb(o.offColor);
    let idx = 0;
    for (let vy = 0; vy < g.OH; vy++) {
      for (let vx = 0; vx < g.OW; vx++) {
        const p = viewToNative(g, vx, vy);
        const bit = readNative(u8g2, p.x, p.y);
        if (bit) {
          data[idx++] = onR; data[idx++] = onG; data[idx++] = onB;
        } else {
          data[idx++] = offR; data[idx++] = offG; data[idx++] = offB;
        }
        data[idx++] = 255;
      }
    }

    const tmp = document.createElement('canvas');
    tmp.width = g.OW;
    tmp.height = g.OH;
    tmp.getContext('2d').putImageData(img, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, o.pad, o.pad, g.OW * scale, g.OH * scale);

    if (o.showGrid && scale >= 4) {
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= g.OW; x++) {
        ctx.moveTo(o.pad + x * scale + 0.5, o.pad);
        ctx.lineTo(o.pad + x * scale + 0.5, o.pad + g.OH * scale);
      }
      for (let y = 0; y <= g.OH; y++) {
        ctx.moveTo(o.pad, o.pad + y * scale + 0.5);
        ctx.lineTo(o.pad + g.OW * scale, o.pad + y * scale + 0.5);
      }
      ctx.stroke();
    }
  }

  return {
    canvas,
    update(u8g2) { paint(u8g2); },
    attach() {},
    /** re-read scale/color options (e.g. from UI controls) */
    setOptions(partial) { Object.assign(o, partial); },
    /** exposed for tests: return the rendered OW x OH ImageData */
    snapshot(u8g2) {
      paint(u8g2);
      return ctx.getImageData(o.pad, o.pad, geom.OW, geom.OH);
    },
  };
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
