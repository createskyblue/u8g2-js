#!/usr/bin/env bash
# gen_families.sh — 生成全部候选中文字体家族（对比挑选用），输出到 fonts/（.bin + .js）
#
# 每个家族 × 尺寸 生成一个全量 CJK 字库（-b 1 公共高度，U+4E00-9FFF 全覆盖）。
# otf2bdf 在中文路径下只能由 bash 直接调用（Python subprocess/os.system 会失败）。
# 已存在的字体自动跳过（可随时重跑）。
#
#   bash tools/fontgen/gen_families.sh
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"        # tools/fontgen
REPO="$(cd "$HERE/../.." && pwd)"            # u8g2-js
TOOL="C:/GITHUB/Python_u8g2_Fonts_Tools"
OUT="$HERE/out/families"
MAP='32-128, $A0-$FF, $2000-$206F, $2100-$214F, $3000-$303F, ~$3031, ~$3032, $3400-$4DBF, $4E00-$9FFF, $FE30-$FE4F, $FF00-$FFEF'

# shortname -> 字体文件（含全部 MapleMono-NF-CN 字重 + 系统常用中文家族）
declare -A FONTS
FONTS[maplelight]="C:/Windows/Fonts/MapleMono-NF-CN-Light.ttf"
FONTS[maplelightitalic]="C:/Windows/Fonts/MapleMono-NF-CN-LightItalic.ttf"
FONTS[mapleregular]="C:/Windows/Fonts/MapleMono-NF-CN-Regular.ttf"
FONTS[maplemedium]="C:/Windows/Fonts/MapleMono-NF-CN-Medium.ttf"
FONTS[maplesemibold]="C:/Windows/Fonts/MapleMono-NF-CN-SemiBold.ttf"
FONTS[maplebold]="C:/Windows/Fonts/MapleMono-NF-CN-Bold.ttf"
FONTS[maplebolditalic]="C:/Windows/Fonts/MapleMono-NF-CN-BoldItalic.ttf"
FONTS[mapleextrabold]="C:/Windows/Fonts/MapleMono-NF-CN-ExtraBold.ttf"
FONTS[mapleextralight]="C:/Windows/Fonts/MapleMono-NF-CN-ExtraLight.ttf"
FONTS[maplethin]="C:/Windows/Fonts/MapleMono-NF-CN-Thin.ttf"
FONTS[simhei]="C:/Windows/Fonts/simhei.ttf"
FONTS[msyh]="C:/Windows/Fonts/msyh.ttc"
FONTS[msyhl]="C:/Windows/Fonts/msyhl.ttc"
FONTS[kaiti]="C:/Windows/Fonts/simkai.ttf"
FONTS[fangsong]="C:/Windows/Fonts/simfang.ttf"
FONTS[notosans]="C:/Windows/Fonts/NotoSansSC-VF.ttf"
FONTS[deng]="C:/Windows/Fonts/Deng.ttf"

SIZES="12 16 24"

for fam in "${!FONTS[@]}"; do
  for size in $SIZES; do
    name="chinese_${fam}_${size}"
    if [ -f "$REPO/fonts/${name}.bin" ]; then
      echo "skip $name (exists)"
      continue
    fi
    dir="$OUT/${fam}_${size}"
    mkdir -p "$dir"
    echo "== $name ($size px) =="
    "$TOOL/otf2bdf.exe" -v -r 72 -p "$size" -o "$dir/font.bdf" "${FONTS[$fam]}" 2>&1 | tail -1
    printf '%s' "$MAP" > "$dir/font.map"
    "$TOOL/bdfconv.exe" -v -b 1 -f 1 "$dir/font.bdf" -M "$dir/font.map" -n "$name" -o "$dir/font.c" -p 100 2>&1 | tail -2
    node "$REPO/tools/convert-fonts.js" "$dir/font.c" -o "$REPO/fonts"
  done
done
echo "DONE: all families generated -> fonts/ (bin + js)"
