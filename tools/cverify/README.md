# Cross-validation against the real U8G2 C library

This harness compiles the original U8G2 C sources and renders the same
drawing scenarios in C and in the JS port, then compares the pixel buffers
**byte-for-byte**. The 11 scenarios cover:

1. text (solid + transparent), boxes, frames, rounded boxes/frames, lines
2. circle, disc, ellipse, filled ellipse, arc
3. triangle (scanline polygon fill)
4. XOR draw color + transparent/solid font modes
5. clip windows
6. font direction + 2x glyphs/strings
7. XBM bitmaps + bitmap transparency
8. button (drawButtonUTF8)
9-12. isolated glyph decoding (single Z, transparent Z, strings)
13. raw font byte dump

plus all four display rotations (R0..R3) on scenario 1.

## Usage

    bash build.sh        # needs gcc; compiles, dumps C buffers, compares

`compare.mjs` fails (exit 1) if any byte differs. It also verifies that the
converted font data is byte-identical to the C array.

## Layout

- `render.c`  – the C harness (draws each scenario into a SSD1306 128x64
  full-frame buffer and dumps `u8g2_GetBufferPtr` to stdout).
- `compare.mjs` – runs the identical scenarios with `u8g2-js` and diffs.
- `c_*.bin`  – generated reference buffers (git-ignored).

> Note: the C program sets stdout to binary mode on Windows
> (`_O_BINARY`) — without it, the CRT translates every 0x0A to 0x0D 0x0A
> and corrupts the dumps.
