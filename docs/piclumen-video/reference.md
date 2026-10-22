# PicLumen Video 工作台参考记录

参考页面：[PicLumen AI Video](https://www.piclumen.com/ai-video/)。采集日期：2026-10-22。用途：按用户要求在 MigosAI 的 `/ai-video-generator` 制作本地复刻预览。使用用户指定的 [web-clone 方法](https://github.com/cuilinhao/claude-skill-web-clone)。

## 素材与权利状态

下列资源地址来自实际页面 DOM 中的 `video` / `poster`，下载后保留原文件内容。本地目录为 `public/portal/video/`，供工作台灵感预览使用。原资源由 PicLumen 页面展示，未核实各作品作者或获得再发布许可；公开可下载不等于开放授权。此记录不表示 MigosAI 拥有这些素材，也不表示已经部署。公开发布前需取得权利或替换为自己的示例。

`content/video-inspiration.ts` 中的标题和提示词为本次新写的描述性示例，不是原作者提示词，也不承诺输入该提示词能复现参考视频。参考作品不标记为 MigosAI 生成结果。

| 本地文件 | 原始资源 | 文件字节数 |
| --- | --- | ---: |
| `forest-action.webp` | [封面](https://publish.piclumen.com/community/20260914/09/bfaf2dc3-7ea8-4b5d-826c-05e6cf5f9323.webp) | 46,122 |
| `forest-action.mp4` | [视频](https://publish.piclumen.com/home_page_video/20260920/11/a2d7fd93-c2f7-46a1-bea6-5d6712e55e36.mp4) | 2,687,716 |
| `palace-portrait.webp` | [封面](https://publish.piclumen.com/community/20260810/17/e7699f8a-9f9b-4d3f-990d-43472382d811.webp) | 17,164 |
| `palace-portrait.mp4` | [视频](https://publish.piclumen.com/home_page_video/20260920/11/a0d8d72c-f13e-4c62-96d4-b37a528b8d8c.mp4) | 3,074,218 |
| `golden-ring.webp` | [封面](https://publish.piclumen.com/community/20260803/13/2e4909b9-eeab-4cfc-b5c4-21b907240048.webp) | 17,112 |
| `golden-ring.mp4` | [视频](https://publish.piclumen.com/home_page_video/20260920/11/2e0e0e92-5d10-4433-b1c2-d880112be3cf.mp4) | 2,866,159 |
| `citrus-perfume.webp` | [封面](https://publish.piclumen.com/community/20260918/14/3f108906-8204-48bb-888a-b26fdab131d3.webp) | 20,580 |
| `citrus-perfume.mp4` | [视频](https://publish.piclumen.com/home_page_video/20260920/11/6ce99658-6ddf-4447-8235-ecbd63407f93.mp4) | 2,679,430 |

8 个资源均返回 HTTP 200 和对应 `image/webp` / `video/mp4` 类型，总计 11,408,501 字节。使用 `ffprobe` 验证 4 个 MP4 均含 H.264 视频和 AAC 音频：forest 1104×836 / 7.04 秒，palace 1280×720 / 20.06 秒，ring 834×1112 / 6.06 秒，perfume 1280×720 / 12.06 秒。原始视频比例不统一，预览卡片使用裁剪呈现；悬停播放应静音。

下载清单、来源 URL、Content-Type 和 SHA-256 保存在忽略目录 `.local-evidence/piclumen-video/source/download-manifest.json`。

## 样式源码证据

从页面实际加载的 Nuxt CSS 下载下列文件，仅作为本地分析证据；未将原站的运行时脚本或 CSS 整包导入应用：

- [ai-video.BgfeJsWw.css](https://statics.piclumen.com/app-1792572575008/_nuxt/ai-video.BgfeJsWw.css)
- [GenerateBox.C-KgN7Om.css](https://statics.piclumen.com/app-1792572575008/_nuxt/GenerateBox.C-KgN7Om.css)
- [Panel.qLDMhU4S.css](https://statics.piclumen.com/app-1792572575008/_nuxt/Panel.qLDMhU4S.css)
- [H5FeaturePanel.CeOs23C8.css](https://statics.piclumen.com/app-1792572575008/_nuxt/H5FeaturePanel.CeOs23C8.css)

原文件及仅在 `}` 后添加换行的 `*.readable.css` 存于 `.local-evidence/piclumen-video/source/`。以下均为 SOURCE 证据，行号对应 readable 文件：

| 文件与行 | 实际规则 | 适用范围 |
| --- | --- | --- |
| `ai-video.BgfeJsWw.readable.css:1` | `.n-tabs-pane-wrapper { height:100% }` | 视频页标签内容容器 |
| `GenerateBox.C-KgN7Om.readable.css:19` | 参数项分隔线 1×12px，左右 margin 4px | 自定义参数控件 |
| `GenerateBox.C-KgN7Om.readable.css:20` | `.mini-slide-in` 动画 0.2s ease-out | 紧凑面板进入 |
| `GenerateBox.C-KgN7Om.readable.css:21` | `.mini-slide-out` 动画 0.15s ease-in，退出时不可点击 | 紧凑面板退出 |
| `GenerateBox.C-KgN7Om.readable.css:22` / `:24` | 两种紧凑面板动画使用 `translate:0 80px` 和 opacity | 动画位移 |
| `Panel.qLDMhU4S.readable.css:1` | Accordion max-height 0.3s ease-in-out | 折叠过渡 |
| `Panel.qLDMhU4S.readable.css:29` | `.upgrade-btn` 背景 #7b57e5，高44px，圆角8px，字体16px/600 | 源码中的升级按钮；其他按钮需再以 DOM 对照确认 |
| `H5FeaturePanel.CeOs23C8.readable.css:1` | NEW 角标圆角 `2px 12px` | 角标 |
| `H5FeaturePanel.CeOs23C8.readable.css:2` | 遮罩 absolute / inset:0 / z-index:20 | 移动面板遮罩 |

这 4 个 CSS 文件均不含 `@media`，不能据此确定原站响应式断点、桌面表单宽度或移动端排列。主布局使用页面 DOM 上的工具类与其他共享样式，须由实际 1440 / 768 / 390 视口观察补充，不能把拟合尺寸标记为上述 CSS 的真实规则。
