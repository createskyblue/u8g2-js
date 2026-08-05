/**
 * setup.js
 *
 * Display presets.  Each entry encodes the geometry that the corresponding
 * u8g2 "setup_..._f" function produces: pixel size, tile size (8x8), the
 * low-level byte layout and the x-offsets used by the hardware driver.
 * Parameters are taken from the u8x8_d_*.c display_info structs in the
 * cloned u8g2 repository.
 *
 * You can use a preset by name:
 *   new U8g2({ display: 'ssd1306_128x64_noname_f' })
 * or define your own display:
 *   new U8g2({ width: 250, height: 122, layout: 'vertical', xOffset: 0 })
 *   (the 250x122 IL3829 e-paper is an example of a custom display.)
 *
 * `layout` is 'vertical' (SSD13xx / e-paper, bytes are columns of 8 px)
 * or 'horizontal' (ST7920 etc., bytes are rows of 8 px, MSB first).
 */

const V = 'vertical';
const H = 'horizontal';

function make(name, pixelWidth, pixelHeight, defaultXOffset, flipXOffset, layout) {
  return {
    name,
    pixelWidth,
    pixelHeight,
    tileWidth: Math.ceil(pixelWidth / 8),
    tileHeight: Math.ceil(pixelHeight / 8),
    defaultXOffset: defaultXOffset || 0,
    flipXOffset: flipXOffset === undefined ? defaultXOffset || 0 : flipXOffset,
    layout: layout || V,
  };
}

export const PRESETS = {
  /* ---- SSD1306 OLED ------------------------------------------------ */
  'ssd1306_128x64_noname': make('ssd1306_128x64_noname', 128, 64, 0, 0, V),
  'ssd1306_128x64_noname_f': make('ssd1306_128x64_noname_f', 128, 64, 0, 0, V),
  'ssd1306_128x32_univision': make('ssd1306_128x32_univision', 128, 32, 0, 0, V),
  'ssd1306_128x32_univision_f': make('ssd1306_128x32_univision_f', 128, 32, 0, 0, V),
  'ssd1306_128x32_winstar': make('ssd1306_128x32_winstar', 128, 32, 125, 125, V),
  'ssd1306_96x16_er': make('ssd1306_96x16_er', 96, 16, 0, 0, V),
  'ssd1306_64x32_noname': make('ssd1306_64x32_noname', 64, 32, 32, 32, V),
  'ssd1306_72x40_er': make('ssd1306_72x40_er', 72, 40, 28, 28, V),

  /* ---- SH1106 (132 wide RAM, visible 128) --------------------------- */
  'sh1106_128x64_noname': make('sh1106_128x64_noname', 128, 64, 2, 2, V),
  'sh1106_128x64_noname_f': make('sh1106_128x64_noname_f', 128, 64, 2, 2, V),
  'sh1106_72x40_wise': make('sh1106_72x40_wise', 72, 40, 30, 30, V),
  'sh1106_64x32': make('sh1106_64x32', 64, 32, 32, 36, V),

  /* ---- SSD1305 / SSD1309 / SSD1315 / SSD1316 / SSD1325 ------------- */
  'ssd1305_128x32_noname': make('ssd1305_128x32_noname', 128, 32, 2, 2, V),
  'ssd1305_128x64_adafruit': make('ssd1305_128x64_adafruit', 128, 64, 2, 2, V),
  'ssd1309_128x64_noname2': make('ssd1309_128x64_noname2', 128, 64, 2, 2, V),
  'ssd1309_128x128_noname0': make('ssd1309_128x128_noname0', 128, 128, 0, 0, V),
  'ssd1315_128x64_noname': make('ssd1315_128x64_noname', 128, 64, 0, 0, V),
  'ssd1316_128x32': make('ssd1316_128x32', 128, 32, 0, 0, V),
  'ssd1316_96x32': make('ssd1316_96x32', 96, 32, 0, 0, V),
  'ssd1325_nhd_128x64': make('ssd1325_nhd_128x64', 128, 64, 0, 8, V),

  /* ---- ST7920 (horizontal byte layout) ----------------------------- */
  'st7920_128x64': make('st7920_128x64', 128, 64, 0, 0, H),
  'st7920_256x32': make('st7920_256x32', 256, 32, 0, 0, H),
  'st7920_128x32': make('st7920_128x32', 128, 32, 0, 0, H),
  'st7920_144x32': make('st7920_144x32', 144, 32, 0, 0, H),
  'st7920_160x32': make('st7920_160x32', 160, 32, 0, 0, H),
  'st7920_192x32': make('st7920_192x32', 192, 32, 0, 0, H),

  /* ---- UC1701 / ST7565 ---------------------------------------------- */
  'uc1701_ea_dogs102': make('uc1701_ea_dogs102', 102, 64, 0, 30, V),
  'uc1701_mini12864': make('uc1701_mini12864', 128, 64, 0, 4, V),
  'st7565_ea_dogm128': make('st7565_ea_dogm128', 128, 64, 0, 4, V),
  'st7565_nhd_c12832': make('st7565_nhd_c12832', 128, 32, 4, 0, V),
  'st7565_ea_dogm132': make('st7565_ea_dogm132', 132, 32, 0, 0, V),

  /* ---- e-paper ------------------------------------------------------ */
  'ssd1606_172x72': make('ssd1606_172x72', 172, 72, 0, 0, V),
  'ssd1607_200x200': make('ssd1607_200x200', 200, 200, 0, 0, V),
  'il3820_296x128': make('il3820_296x128', 296, 128, 0, 0, V),

  /* ---- convenient generic aliases ----------------------------------- */
  'ssd1306_128x64': make('ssd1306_128x64', 128, 64, 0, 0, V),
  'ssd1306_128x32': make('ssd1306_128x32', 128, 32, 0, 0, V),
  'sh1106_128x64': make('sh1106_128x64', 128, 64, 2, 2, V),
  'st7920_128x64': make('st7920_128x64', 128, 64, 0, 0, H),
  'ssd1607_200x200': make('ssd1607_200x200', 200, 200, 0, 0, V),
};

/* fall back to a matching preset by loose name (case/underscore-insensitive) */
function matchPreset(name) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = norm(name);
  for (const [presetName, cfg] of Object.entries(PRESETS)) {
    if (norm(presetName) === key) return cfg;
    if (norm(presetName).replace(/_f$/, '') === key.replace(/_f$/, '')) return cfg;
  }
  return null;
}

function customPreset(options) {
  const w = options.width;
  const h = options.height;
  if (!w || !h) throw new Error('U8g2: custom display needs width and height');
  const off = options.xOffset || 0;
  return make(
    `custom_${w}x${h}`,
    w,
    h,
    off,
    options.flipXOffset === undefined ? off : options.flipXOffset,
    options.layout || V,
  );
}

/**
 * Resolve a display configuration from constructor options.
 * Accepts:
 *   { display: 'ssd1306_128x64_noname_f' }
 *   { width, height, layout?, xOffset? }
 *   { display: { width, height, ... } }
 */
export function resolveDisplay(options) {
  if (options == null) return make('default_128x64', 128, 64, 0, 0, V);
  if (typeof options.display === 'string') {
    let cfg = PRESETS[options.display] || matchPreset(options.display);
    if (!cfg) throw new Error(`U8g2: unknown display preset "${options.display}"`);
    if (options.pageRows) return { ...cfg, pageRows: options.pageRows };
    return cfg;
  }
  if (typeof options.display === 'object' && options.display !== null) {
    return customPreset(options.display);
  }
  if (options.width && options.height) {
    return customPreset(options);
  }
  return make('default_128x64', 128, 64, 0, 0, V);
}

export function listPresets() {
  return Object.keys(PRESETS).sort();
}
