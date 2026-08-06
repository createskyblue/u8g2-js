# u8g2-js

🌐 [English](./README.md) · **中文**

**U8G2 单色图形库的纯 JS 移植** —— 在浏览器里像素级仿真单色屏显示，AI 开发并视觉验证后，同一份代码直接部署真机。

![212x102 墨水屏传感器仪表盘](img/co2-mode.jpg)

## U8G2：单色屏的事实标准

OLED、单色点阵液晶屏（12864 那种灰白屏）、墨水屏这类**单色屏**，资源有限，跑不动 LVGL 那种重型 GUI；它们的图形库事实标准是 **U8G2**——支持几十种屏幕控制器、庞大的字体库、内存占用极小。做单色屏显示，基本就是 U8G2。

## 痛点

U8G2 开发很慢：改一次显示效果，就要重新编译、烧录、上板看，一轮几十秒到几分钟；AI 写的 U8G2 代码经常"能编译过、屏幕不对"，字体、坐标、布局来回调都不对。

## 本项目：u8g2-js

我们把 U8G2 完整移植成纯 JS，在浏览器里**像素级仿真单色屏**。AI（Codex / Claude）在浏览器里完成整个闭环：

1. **开发** U8G2 显示界面（JavaScript，浏览器原样运行）
2. **视觉验证**：运行、截图，多模态识图逐像素检查
3. **用户确认**：效果符合预期，即通过
4. **部署**：同一份代码上真机（与原生 U8G2 C 库 API 一致）

显示逻辑**在浏览器里提前验证**，而不是上板后才发现问题。

**仓库：** [github.com/createskyblue/u8g2-js](https://github.com/createskyblue/u8g2-js)

**在线演示：** [createskyblue.github.io/u8g2-js](https://createskyblue.github.io/u8g2-js/)

## 为什么同一份代码能上真机

- **像素级还原**：拿同一个官方 Demo，用 gcc 编译的 C 版跑一遍、导出屏幕像素图，JS 版再跑一遍、导出屏幕像素图，**两张图逐像素对比，差异 = 0**。帧缓冲、字体、`draw_color`、旋转——浏览器里看到什么，真机就是什么
- **字体即字节数组**：运行时加载任意 U8G2 字体；内置全量中文字库（宋体 8/10/12/16/24/32 px）
- **零依赖纯 ESM**：浏览器 / Node 直接跑
- 完整游戏也能跑，如《炸弹人》，真机同款 128×64 渲染：

![Bomberman 游戏运行在 u8g2-js 上](img/Bomberman.jpg)

## 快速开始

```js
import { U8g2, U8g2Font } from './src/index.js';

const u8g2 = new U8g2({ display: 'ssd1306_128x64_noname_f' });
u8g2.setFont(U8g2Font.fromBase64('AP//AA...')); // 字体就是字节数组
u8g2.drawStr(0, 10, 'Hello');
u8g2.sendBuffer();
u8g2.attachCanvas(document.getElementById('screen'));
```

在项目根目录起 live server（`npx serve .`）→ 打开 `index.html` 进入各示例。

## License

BSD-2-Clause，保留原 U8G2 版权声明。
