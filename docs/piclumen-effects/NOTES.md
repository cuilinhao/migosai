# PicLumen Effects 目录核对记录

采集日期：2026-10-22。原页：[PicLumen Effects](https://www.piclumen.com/video-effects/)。当前任务为按用户要求把该页的全部视频与封面加入 MigosAI 本地 `/effects` 展示。

## 来源与完整性

原站没有找到可直接复用的官方开源仓库，使用公开页面的实际 DOM、SSR Nuxt payload 及其实际引用的部署 JavaScript 作为证据。原始文件放在忽略目录 `.local-evidence/piclumen-effects/`，没有把原站运行时脚本加入 MigosAI 应用。

**核对结果：77 条效果、77 个唯一视频，无遗漏或重复，顺序一致。**

- 浏览器滚动到列表末端后，提取77个唯一可见效果。原站虚拟列表还保留26个移到屏幕外的旧节点；这些缓存副本没有计入。目录保存为 `original-catalog.json`。
- 页面 SSR payload 的 `pinia.templateStore.templateList` 包含前50条；`pageParams` 为 `{pageNum:2,pageSize:50,maxPage:2}`，不能把首批50条误当全部。
- 在核实原站源码中的公开 GET 列表接口、参数和 `apiBase` 后，读取第二页，响应 HTTP200、业务 `status:0`、`total:77`，含剩余27条。此调用没有携带账号或认证信息，也没有执行生成、收藏或其他写入。
- 将SSR前50条与第二页27条合并，与浏览器77条逐条比较：视频文件路径、封面文件路径、slug及排序完全一致；标题/描述在仅统一空白符后全部一致。
- 第一条为 `Rap Duo`，第50条为 `Skeleton Ball Gala`，第51条为 `Tilt Dance`，最后一条为 `Kemusan Dance`。

核对产物：`source/payload-decoded.json`、`source/initial-template-list.json`、`source/template-page-2.json`、`source/all-effects.json`、`source/catalog-verification.json`。

## 源码证据（SOURCE）

当前公开部署目录：`https://statics.piclumen.com/app-1792654482667/_nuxt/`。下列行号指本地仅按分号换行的 `*.readable.js`，用于定位，不改变源代码语义。

| 来源 | 行/位置 | 确认内容 |
| --- | --- | --- |
| `source/video-effects.html` | `window.__NUXT__.config.public.apiBase` | 列表基础地址为 `https://api.piclumen.com/api` |
| `source/C2vGVT3M.readable.js` | 3 | templateStore 默认 `pageNum:1,pageSize:50,maxPage:1` |
| `source/BN9rOdXK.readable.js` | 2 | `/app-template/list` 为 GET，`isPublic:true` |
| `source/DA__exM_.readable.js` | 37–42 | 读取页码/页大小，以 `resultList` 追加列表，以 `Math.ceil(total/pageSize)` 更新最大页 |
| `source/DA__exM_.js` | `te()`、`E(se,...)` | 首次加载与末端 IntersectionObserver 触发下一页；超过最大页停止 |
| `source/DA__exM_.js` | `X=F(...)`、`Z=F(...)` | 响应式网格：≥2048px五列，≥1660px四列，≥1280px三列，其余两列 |
| `source/DA__exM_.js` | `V`、`z`、`A` | 媒体约16:9，8px圆角；标题14px；描述12px/18px、最多两行 |

SSR和API使用 `images.piclumen.com`，实际浏览器展示资源使用 `publish.piclumen.com`。核对采用精确媒体路径，域名替换不算不同内容。本地下载以浏览器实际资源地址为准。

## 使用边界

原站展示的这些素材并未核实为开放授权。当前是用户要求的本地复刻预览；该记录不表示 MigosAI 拥有素材版权或已公开部署。保留来源清单，不把参考视频标记为 MigosAI 生成结果。视频展示和播放不等于已经接入对应模板的生成能力。

## 实现与资源

采用 L3 数据驱动画廊重建：保留原站卡片顺序、媒体比例、排版和网格断点，接入现有 MigosAI 导航与品牌。没有引入原站追踪脚本或运行时。

- `content/effects-catalog.json`：77条完整目录，保留标题、描述、来源链接和本地媒体路径。
- `public/effects/piclumen/`：77个视频与77张封面，154个文件共188,708,848字节（约180MiB）。单文件最大5,056,073字节。
- `assets.json`：下载地址、本地路径、HTTP状态、字节数、SHA256与媒体探测信息。
- `scripts/import-piclumen-effects.py`：可重复运行的导入程序；已有文件校验通过后复用。
- `components/effects/` 与 `app/effects/page.tsx`：完整画廊、悬停或键盘聚焦预览、弹窗播放、前后切换及左右键切换。关闭弹窗恢复原卡片焦点，播放失败提供重试。
- 初次进入只展示封面，不挂载77个视频；卡片预览按需挂载，同时只播放一个。减少动态效果偏好会关闭自动预览。
- 播放器操作文案适配现有6种语言；效果标题和描述保留来源原文。

## 验收结果

2026-10-22 在本地 Worker 预览 `http://127.0.0.1:3000/effects` 验证：

- 154个媒体下载均HTTP200，SHA256校验通过；77个视频全部通过ffprobe与完整ffmpeg解码，无损坏文件。
- 本地154个资源、6种语言Effects页面及视频生成页共161次HTTP检查均200。
- 1440、768、390三档浏览器检查：均显示77张卡片与77张封面，首屏无视频挂载，没有水平溢出；浏览器错误日志为空。
- 实际播放第一条Rap Duo与最后一条Kemusan Dance，媒体readyState为4；首尾循环、左右键切换、关闭弹窗焦点恢复均通过。
- `npm run typecheck` 通过。
- `npm test -- --exclude components/landing/landing-page.test.tsx`：88个测试文件、1464个测试通过。其中Effects新增8项测试。排除项是同工作区另一项进行中的landing修改及其已知失败，不属于本次变更。
- `npx opennextjs-cloudflare build --dangerouslyUseUnsupportedNextVersion` 构建通过。该参数用于项目现有Next版本的OpenNext支持日期限制，本次未更改依赖。
- 证据保存在 `.local-evidence/piclumen-effects/`：`local-1440.png`、`local-768.png`、`local-390.png`、原站同尺寸截图、`local-http-check.json`、`media-decode.json`、`tests.log` 和 `build.log`。

复刻评分（5分制，人工依据截图和实际交互评估）：结构5、视觉4、交互4、响应式5、品牌替换5、视频展示功能5。视觉差异主要是MigosAI导航与移动端站点页头；交互范围是展示和播放，未复刻原站模板生成业务。

本次没有执行付费视频生成，没有公开部署。全部媒体已本地保存，站点运行时播放不依赖原站媒体域名。
