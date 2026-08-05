# u8g2-js

🌐 [English](./README.md) · **中文**

把 [U8G2](https://github.com/olikraus/u8g2) 单色图形库**纯 JS 移植**到浏览器 / Node，
**像素级还原真机渲染**，用于 AI 生成代码 + 浏览器仿真，方便后续基于 U8G2 做小型设备开发。

- **零构建、零依赖**：原生 ES Module，浏览器 `file://` 直接可用，Node 同样可跑。
- **像素级还原**：帧缓冲布局、`draw_color` 0/1/2、字体 RLE 位流解码、`draw_l90` 旋转变换、
  Bresenham 图元 —— 全部与 C 源码 1:1 移植，**已与原版 C 库逐字节交叉验证**（见 [验证](#验证)）。
- **字体运行时加载**：字体本质就是 `Uint8Array` 字节流，运行时用你自己的 JS 载入，
  支持任意 U8G2 字体（含 `bdfconv` 生成的中文字体）。
- **API 兼容**：Arduino `U8g2lib` 风格 camelCase 为主，同时提供 C 风格 snake_case / `u8g2_*` 别名。

## 基于的上游版本

本移植对照 **U8G2 上游 master 分支**的基准提交：

```
commit ab9e48b2228351e9476682a70b7f3ee4909cd585
Date:   2026-06-27 16:10:31 +0200
Subject: Merge pull request #2786 from iggymayer/fix-flipmode-ssd1362z-OEL1M0033WE
```

原版 C 库已浅克隆到本仓库旁边的 `u8g2/` 目录（仅此提交），
`tools/cverify/build.sh` 的**逐字节交叉验证正是针对这一版 C 库**进行的。
要升级基准版本：重新 `git clone https://github.com/olikraus/u8g2.git` 到最新 master，
并重跑 `bash tools/cverify/build.sh` 确认一致性后即可。

## 快速开始

```js
// 浏览器：<script type="module">
import { U8g2, U8g2Font } from './u8g2-js/src/index.js';

// 建一块 SSD1306 128x64 屏
const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });

// 运行时载入字体（字体就是字节数组）
const font = await U8g2Font.load('./u8g2-js/demo/fonts/u8g2_font_5x7_tf.bin');
u8g2.setFont(font);

// 画图 —— 与 Arduino 写法一致
u8g2.clearBuffer();
u8g2.drawStr(0, 10, 'Hello');
u8g2.drawBox(0, 20, 10, 5);
u8g2.drawCircle(60, 30, 8, 15);
u8g2.sendBuffer();

// 挂到 <canvas> 上显示
u8g2.attachCanvas(document.getElementById('screen'));
```

Node 端同样可用（无头导出 PBM/原始字节，适合测试）：

```js
import { U8g2, U8g2Font, toPBM } from './u8g2-js/src/index.js';
const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
u8g2.setFont(await U8g2Font.load('demo/fonts/u8g2_font_5x7_tf.bin'));
u8g2.drawStr(0, 10, 'Hello');
console.log(toPBM(u8g2));   // 导出 P4 PBM
```

## 演示（demo）

打开 `demo/demo-standalone.html` —— 自包含单文件，**直接双击就能跑**（file://，无需服务器）。

里面是一个交互式仿真器：选屏、旋转、缩放、网格、写 U8G2 代码、动画循环、**运行时加载任意字体**
（下拉 / `.bin` 文件 / 粘贴 base64）。默认示例就是一个**中文仪表盘**（温度传感器 / 湿度 / 状态），
演示内置的全量中文字库。

开发态可改 `demo/demo.html`（ESM，需本地服务器），改完重新打包：

```bash
node tools/build-demo.js      # 生成 demo/demo-standalone.html
node tools/check-demo.js      # 启动自检（DOM stub 冒烟测试）
```

## 内置中文字库（全量）

demo 内置 **`chinese_full_12` / `chinese_full_16` / `chinese_full_24`** 三个全量中文字库
（字体源：**SimSun 宋体** `C:\Windows\Fonts\simsun.ttc`），字符集覆盖：

- **全部 CJK 统一汉字 U+4E00–U+9FFF**（20902 字，含生僻字）+ CJK 扩展 A U+3400–4DBF
- 全 ASCII 0x20–0x7E + Latin-1（° ± × ÷ · …）
- 中文标点、℃ ℉ 等符号、全角形式、CJK 兼容形式

共 **~2.8 万字形**，模拟器里 AI 生成/写出的任意中文都能渲染。

**垂直对齐说明**：字体用 bdfconv **公共高度模式 `-b 1`** 生成，所有字形共享统一的
em 方框（12px→15 高 / 16px→18 高 / 24px→26 高，行高一致、多行对齐正确）。
改用 **SimSun 宋体**后，**CJK 字形统一坐基线**（底部对齐基线、顶部一致），不再有 MapleMono
那种"度"笔画探出基线、字浮动的问题。每个字形内部的**墨迹高低仍然不同**
（如"一"是短横、位于框中下部）——这是位图字体的正常行为，U8G2 官方 CJK 字体一致。
另外 map 中**排除了 U+3031/3032（〱〲 竖排重复记号）**，它们的 BBox 高达 30px，
会把公共高度/行高错误地顶高。

备选字体：`NotoSansSC-VF.ttf`（OFL 开源，但 VF 默认字重偏细）、`MapleMono`（原用，CJK 基线不齐）。
改 `gen_full.py` 里的 `FONT` 路径即可换源。

这三个字体由 `tools/fontgen/gen_full.py` 生成：

```bash
python tools/fontgen/gen_full.py    # 调 Python_u8g2_Fonts_Tools 的 otf2bdf + bdfconv
node tools/convert-fonts.js tools/fontgen/out/cn16/code/chinese_full.c -o demo/fonts --format bin,js
```

> ⚠️ 生成全量字库的 bdfconv 注意：字库工具**旧版捆绑的 bdfconv.exe**（per-entry=100）在约
> 2 万 Unicode 字形时会断言失败；已把工具的 `bdfconv.exe` 换成 **olikraus/u8g2 当前源码的构建**
> （per-entry=101，无此问题）。生成结果经原版 C 库逐字节验证一致。

字库生成工具（otf2bdf + bdfconv + 中文提取，本项目字体由它生成）：
[Easy-u8g2-font-generate-tools](https://github.com/createskyblue/Easy-u8g2-font-generate-tools)
（Gitee 镜像：`https://gitee.com/createskyblue/Easy-u8g2-font-generate-tools`）

## 字体：运行时动态加载

字体就是与真机一致的字节流（U8G2 "new font format"）。四种载入方式：

```js
// 1) 从转换工具产物（base64）
U8g2Font.fromBase64("AP//AA...")

// 2) 直接贴 .c 源文件里的 C 字符串（八进制转义）
U8g2Font.fromC("\\277\\0\\2\\2\\3\\3...")

// 3) 就是数组
U8g2Font.fromArray(new Uint8Array([...]))

// 4) 远程 / 本地文件
await U8g2Font.load("/fonts/u8g2_font_5x7_tf.bin")   // 浏览器 fetch / Node 读文件
```

注册进运行时注册表后可 `setFont(名字)`：

```js
U8g2Font.register('my_font', fontData);   // fontData 可以是 U8g2Font / Uint8Array / base64
u8g2.setFont('my_font');
```

`setFont()` 也直接接受 `U8g2Font` 实例、`Uint8Array` 或 base64 字符串，随你方便。

### 转换自己的字体

任意 U8G2 字体 `.c` 文件（含 **bdfconv 生成的中文字体**，格式相同）都能转：

```bash
# 单个：demo/fonts/u8g2_font_5x7_tf.c -> .bin（推荐，直接 fetch/读文件）
node tools/convert-fonts.js ../u8g2/tools/font/build/single_font_files/u8g2_font_5x7_tf.c \
  -o demo/fonts --format bin

# 输出 .js（base64 模块，import 即用）或 .json
node tools/convert-fonts.js .../u8g2_font_myfont.c -o myfonts --format js

# 批量转一整个目录
node tools/convert-fonts.js --batch .../single_font_files -o myfonts --format bin
```

`demo/fonts/` 里已内置 9 个经典示例字体 + 3 个全量中文字库（均含 .bin + .js）。

### 官方字体包 —— 全部 2174 个 U8G2 字体预编译成 JS

**官方 U8G2 全部字体**已预编译成可直接 import 的 JS 模块，放在 `fonts/` 下
（一个字体一个文件：`u8g2_font_5x7_tf.js`、`u8x8_font_8x16_1x2_f.js` …）。
数据**逐字节取自 C 数组**，与真机编译到设备里的字体字节完全一致
（已用 `gcc` 编译出的参考数组逐字节对拍验证；每个字体的长度也按 `.c` 头里声明的 `[N]` 校验过）。

```js
import b64 from 'u8g2-js/fonts/u8g2_font_10x20_tf.js';

const font = U8g2Font.fromBase64(b64);            // -> U8g2Font
U8g2Font.register('u8g2_font_10x20_tf', font);    // 然后 setFont('u8g2_font_10x20_tf')
```

每个模块都是自包含的小 ESM，只导出一个 base64 字符串——不想一次全打进来的话，
可以按需 import，交给打包器 tree-shake。

`fonts/index.json` 是所有 2174 个字体的轻量清单：`{ name, file, size, glyphs }`，
适合用来搭字体选择器（比如仿真器里的下拉列表），不用把字体数据本身全加载进来。

从上游 C 源重新生成 / 刷新这个包：

```bash
node tools/convert-all-fonts.js            # 读 ../u8g2/tools/font/build/single_font_files
                                           # 生成 fonts/*.js + fonts/index.json
```

## 显示设备

`setup.js` 里注册了 ~30 种常见屏（参数取自 u8x8_d_*.c 的 display_info）：

| 控制器 | 型号 |
|---|---|
| SSD1306 | 128x64 / 128x32 / 96x16 / 64x32 / 72x40 |
| SH1106 | 128x64 / 72x40 / 64x32 |
| SSD1305 / 1309 / 1315 / 1316 / 1325 | 128x32 / 128x64 / 128x128 / 96x32 … |
| ST7920（横向字节布局）| 128x64 / 256x32 / 144x32 / 160x32 / 192x32 |
| UC1701 / ST7565 | 102x64 / 128x64 / 132x32 |
| 墨水屏 | SSD1606 172x72 / SSD1607 200x200 / IL3820 296x128 |

任意尺寸自定义屏（含 **250×122 IL3829 这类**，树里没有的型号）：

```js
new U8g2({ width: 250, height: 122, layout: 'vertical', xOffset: 0 });
```

`listPresets()` 列出全部预设名。

## API

主 API 与 Arduino `U8g2` 类一致（`drawStr` / `setFont` / `sendBuffer` …），
同时提供 C 风格别名（`u8g2_draw_str` / `u8g2_DrawStr` / `draw_str`），代码可平移到真机。

**生命周期/页缓冲**：`begin` `clearBuffer` `sendBuffer` `firstPage` `nextPage` `clearDisplay`
`clear` `setAutoPageClear` `getBufferPtr/Size/TileWidth/TileHeight` `updateDisplay` `updateDisplayArea`

**颜色**：`setDrawColor`(0/1/2) `getDrawColor` `setBitmapMode`

**图元**：`drawPixel` `drawLine` `drawHLine` `drawVLine` `drawHVLine` `drawBox` `drawFrame`
`drawRBox` `drawRFrame` `drawCircle` `drawDisc` `drawEllipse` `drawFilledEllipse` `drawArc`
`drawTriangle` `clearPolygonXY/addPolygonXY/drawPolygon` `drawXBM` `drawXBMP` `drawBitmap`

**文本/字体**：`setFont` `setFontMode` `setFontDirection` `setFontPosBaseline|Top|Bottom|Center`
`setFontRefHeightText|ExtendedText|All` `drawStr` `drawStrX2` `drawUTF8` `drawUTF8X2`
`drawGlyph` `drawGlyphX2` `drawExtendedUTF8` `drawExtUTF8`(字距) `drawHB`
`getStrWidth` `getUTF8Width` `getGlyphWidth` `getXOffsetGlyph|UTF8` `getStrX`
`isGlyph` `isAllValidUTF8` `getAscent` `getDescent` `getMaxCharWidth|Height` `getFontBBX*`

**裁剪/窗口**：`setClipWindow` `setMaxClipWindow` `isIntersection` `getClipWindow`

**杂项**：`setDisplayRotation`(R0-R3) `setFlipMode` `setContrast` `setPowerSave`
`drawButtonFrame` `drawButtonUTF8` `setCursor` `home` `print` `println` `sleepOn|Off`
`getDisplayWidth|Height` `getWidth|Height`

**不做**（如实标注）：`drawLinePattern/Gradient`（本版本 U8G2 已移除）、
u8x8 底层 I2C/SPI 协议字节流（浏览器仿真无需）、8x8 文本屏、`drawLog/U8G2LOG`。

## 目录结构

```
u8g2-js/
  src/
    u8g2.js           # U8g2 主类：生命周期/页缓冲/文本/裁剪/旋转
    draw.js           # 图元：box/line/circle/ellipse/arc/triangle/xbm/button
    hvline.js         # 底层像素写入（vertical_top_lsb / horizontal_right_lsb）
    font.js           # U8g2Font：头解析/字形查找/RLE 位流解码
    utf8.js           # UTF-8 解码（u8x8_utf8_next 移植）
    setup.js          # 显示屏预设表 + 自定义屏
    renderer/         # canvas.js（浏览器显示） + pbm.js（无头导出）
    index.js          # 统一出口
  demo/               # 交互式仿真页（demo.html + demo-standalone.html）
  fonts/              # 官方字体包：2174 个预编译 JS 模块 + index.json
  tools/
    convert-fonts.js  # .c 字体 -> .bin/.js/.json（含批量）
    convert-all-fonts.js # 全部 .c 字体 -> fonts/*.js + fonts/index.json
    build-demo.js     # 打包自包含 demo-standalone.html
    check-demo.js     # demo 启动自检
    cverify/          # 与原版 C 库逐字节交叉验证
  test/test.js        # Node 无头测试套件（30 项）
```

## 验证

1. **与原版 C 库逐字节交叉验证**（`tools/cverify/build.sh`，需 gcc）：
   编译真 U8G2 C 库渲染 18 项场景/检查（文本/图形/旋转/裁剪/XOR/按钮/Unicode/**全量中文字库渲染**、
   字体数据一致），与 JS 移植逐字节比对 —— **全部一致**。
2. **Node 无头测试**：`node --test`，30 项全过。
3. **Demo 自检**：`node tools/check-demo.js`。

## License

BSD-2-Clause。本库是 U8G2 的 JS 移植（含转换后的字体数据），保留原作者版权声明。

参考：原始 C 库已克隆到相邻目录 `u8g2/`，可对照阅读。
