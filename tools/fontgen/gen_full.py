#!/usr/bin/env python3
"""
gen_full.py — 生成"全量中文"U8G2 字库（12 / 16 / 24 px）。

字符集 = 全量 CJK：
  - ASCII 0x20-0x7E
  - Latin-1 0xA0-0xFF（° ± × ÷ · …）
  - 通用标点 U+2000-206F、Letterlike U+2100-214F（℃ ℉ №）
  - CJK 标点 U+3000-303F、CJK 扩展A U+3400-4DBF、CJK 统一汉字 U+4E00-9FFF（20902）
  - CJK 兼容形式 U+FE30-FE4F、全角形式 U+FF00-FFEF

依赖：Python_u8g2_Fonts_Tools 的 otf2bdf.exe 与 bdfconv.exe。
注意：bdfconv.exe 须为 **olikraus/u8g2 当前源码的构建**（per-entry=101）——
旧版捆绑二进制（per-entry=100）在约 2 万 Unicode 字形时会断言失败。

用法：
    python gen_full.py            # 生成 out/cn{12,16,24}/code/chinese_full.c
"""
import os
import subprocess

TOOL = "C:/GITHUB/Python_u8g2_Fonts_Tools"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
# 中文字体源。默认 SimSun（宋体，衬线，系统自带，CJK 坐基线、字形优雅）。
# 备选：simhei.ttf（黑体）、NotoSansSC-VF.ttf（OFL 开源但 VF 字重偏细）、MapleMono（CJK 基线不齐）。
FONT = "C:/Windows/Fonts/simsun.ttc"
BDFCONV = os.path.join(TOOL, "bdfconv.exe")
OTF2BDF = os.path.join(TOOL, "otf2bdf.exe")

# 全量字符映射。排除 U+3031/3032（〱〲 竖排重复记号）：它们的 BBox 高达 30px，
# 会把公共高度/行高顶到 30px。排除后行高恢复正常（16px 字体为 21px）。
FULL_MAP = (
    "32-128, $A0-$FF, $2000-$206F, $2100-$214F, $3000-$303F, "
    "~$3031, ~$3032, $3400-$4DBF, $4E00-$9FFF, $FE30-$FE4F, $FF00-$FFEF"
)

SIZES = [12, 16, 24]


def main():
    for size in SIZES:
        size_dir = os.path.join(OUT, f"cn{size}")
        bdf_dir = os.path.join(size_dir, "bdf")
        map_dir = os.path.join(size_dir, "map")
        code_dir = os.path.join(size_dir, "code")
        for d in (bdf_dir, map_dir, code_dir):
            os.makedirs(d, exist_ok=True)

        bdf_name = os.path.splitext(os.path.basename(FONT))[0]
        bdf = os.path.join(bdf_dir, f"{bdf_name}_{size}.bdf")
        mapf = os.path.join(map_dir, "chinese_full.map")
        code = os.path.join(code_dir, "chinese_full.c")

        if not os.path.exists(bdf):
            print(f"> otf2bdf {size}px ...")
            # otf2bdf always exits 8 under python subprocess; os.system is what
            # Python_u8g2_Fonts_Tools/main.py uses and works fine.
            cmd = f'"{OTF2BDF}" -v -r 72 -p {float(size)} -o "{bdf}" "{FONT}"'
            rc = os.system(cmd)
            if rc != 0 or not os.path.exists(bdf):
                raise RuntimeError(f"otf2bdf failed for {size}px (rc={rc})")

        with open(mapf, "w", encoding="utf-8") as f:
            f.write(FULL_MAP)

        print(f"> bdfconv {size}px (common height -b 1) ...")
        subprocess.run(
            [BDFCONV, "-v", "-b", "1", "-f", "1", bdf,
             "-M", mapf, "-n", f"chinese_full_{size}", "-o", code, "-p", "100"],
            check=True,
        )
        print(f"  -> {code}")
    print("done")


if __name__ == "__main__":
    main()
