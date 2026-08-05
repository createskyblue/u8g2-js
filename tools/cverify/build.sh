#!/usr/bin/env bash
# Build the real U8G2 C library, render every test scenario to a binary
# buffer dump, then compare the JS port byte-for-byte.
#
# Requires: gcc (MinGW or any C compiler). Run from this directory:
#   bash build.sh
#
# Layout: this directory must be R:/u8g2移植/u8g2-js/tools/cverify and the
# cloned u8g2 repository must be at ../../../u8g2 relative to it.
set -e
cd "$(dirname "$0")"

U8G2="../../../u8g2"
CSRC="$U8G2/csrc"
FONT="$U8G2/tools/font/build/single_font_files/u8g2_font_5x7_tf.c"
FONT_UNIFONT="$U8G2/tools/font/build/single_font_files/u8g2_font_unifont_t_symbols.c"
FONT_CN_FULL="../../tools/fontgen/out/cn12/code/chinese_full.c"

echo ">> compiling the C library + harness..."
gcc -O0 -o render.exe render.c \
  "$CSRC"/u8g2_d_setup.c "$CSRC"/u8g2_d_memory.c "$CSRC"/u8g2_setup.c \
  "$CSRC"/u8g2_buffer.c "$CSRC"/u8g2_cleardisplay.c "$CSRC"/u8g2_hvline.c \
  "$CSRC"/u8g2_ll_hvline.c "$CSRC"/u8g2_box.c "$CSRC"/u8g2_line.c \
  "$CSRC"/u8g2_circle.c "$CSRC"/u8g2_arc.c "$CSRC"/u8g2_polygon.c \
  "$CSRC"/u8g2_bitmap.c "$CSRC"/u8g2_button.c "$CSRC"/u8g2_font.c \
  "$CSRC"/u8g2_kerning.c "$CSRC"/u8g2_intersection.c \
  "$CSRC"/u8x8_byte.c "$CSRC"/u8x8_cad.c "$CSRC"/u8x8_capture.c \
  "$CSRC"/u8x8_display.c "$CSRC"/u8x8_setup.c "$CSRC"/u8x8_8x8.c "$CSRC"/u8x8_gpio.c \
  "$CSRC"/u8x8_string.c "$CSRC"/u8x8_u16toa.c "$CSRC"/u8x8_d_*.c \
  "$FONT" "$FONT_UNIFONT" "$FONT_CN_FULL" \
  -I "$CSRC" -include "$CSRC/u8g2.h" -DU8G2_USE_LARGE_FONTS

echo ">> rendering reference buffers with the C library..."
for s in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  ./render.exe "$s" 0 > "c_s${s}_r0.bin"
done
for r in 1 2 3; do
  ./render.exe 1 "$r" > "c_s1_r${r}.bin"
done

echo ">> comparing with the JS port..."
node compare.mjs
