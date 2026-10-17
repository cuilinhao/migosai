# Flying Car AI 来源、覆盖范围与迁移差异

本次迁入基于用户自有 [Flying Car AI](https://flyingcar-ai.app/) 在 2026-10-17 的真实发布资产，模式为**公开内容与视觉忠实迁入，生成及商业流程接入 migosai**。没有运行原站 JavaScript，没有复制其支付、分析或匿名订单服务。

## 真源码证据与边界

优先检索了本机 Desktop 项目、已登录 GitHub 账户的仓库元数据及 flyingcar-ai 公开仓库搜索，未找到该站源代码仓库。随后保存了原站预渲染 HTML、真实部署 JS/CSS、站点地图及全部可见媒体。

- 初始部署包：`/assets/index-DREn6o-_.js`。源映射 `.map` 返回 404。
- 任务期间原站更换为 `/assets/index-nlP9j1ZZ.js`。对两包格式化后逐行比较，差异只有三个 SEO description 字符串，公开正文、FAQ、生成约束、资源和交互逻辑相同。最终记录新包原始响应 SHA256 与格式化副本 SHA256。
- 样式：`/assets/index-BECjiMG-.css`。
- 原始抓取目录：`/tmp/flyingcar-recon/`。复原后的持久证据见 `content/flyingcar-source-manifest.json`、`content/flyingcar-interactions.json`、`content/flyingcar-source-legal.json`。
- 原始 JS 在这里用作文字证据；页面由本项目自己的 React renderer 和生成组件运行。没有把原站 bundle 当脚本引入。

静态页面、字体和媒体属于 L2 内容站范围，有可核对的真实部署资产，可以忠实保留。上传、模型调用、任务状态、登录、积分及历史记录属于 L3 应用流程：本次集成现有 migosai 服务，不能把匿名订单 API 的接口形状当成已获得的原站服务端实现。

## 页面与全文覆盖

| 原公开路径 | 处理方式 | FAQ | 非商业原文校验单元 |
| --- | --- | ---: | ---: |
| `/` | 展示于 `/flying-car-ai-video-generator`，保留 hero、四示例、受众、FAQ、教程入口、流程、页尾 | 17 | 56 |
| `/how-to-make-a-tesla-roadster-flying-car-video` | 完整文章迁至上面路径的同名子路由 | 6 | 69 |
| `/tesla-flying-car-ai-video-trend` | 完整文章迁至上面路径的同名子路由 | 0 | 31 |
| `/privacy` | 保留原文树作来源证据；实际导航指向 migosai `/privacy-policy` | 0 | 原始标题全部校验 |
| `/terms` | 保留原文树作来源证据；实际导航指向 migosai `/terms-of-service` | 0 | 原始标题全部校验 |

共有 **3 个展示页、2 个法律源文档、23 条完整 FAQ**。首页 SSR 只有折叠问题，答案从公开 JS 的字面量数组恢复，使用原生 `details/summary` 保证无 JS 时仍可展开。两篇文章的章节、段落、列表、图注和链接均由 HTML 树导入，没有重写或缩写文章。

`source-manifest.json` 同时记录源页面 SHA256、源标题、原始文字长度，以及 **156 个保留的非商业标题/段落/列表项/图注/FAQ 答案**。49 个单元标记为商业流程或动态组件替换，并说明原因。回归测试从此来源证据动态读取校验单元，检查迁入树仍包含全部原文；测试文件未硬编码文章全文。

生成器节点的约定是：保留 `section#create` 与标题介绍，将原 `creator-grid` 和底部按钮/状态行整体替换为 `{slot:"generator"}`；定价块替换为 `{slot:"credits"}`。其他数据为 `{tag,attrs,children}` 或字符串。`header` 与 `footer` 也使用此结构。

## 提示词、字段与交互

公开客户端的提示词初始值是空字符串，**没有预设选择器、完整示例生成 prompt 或公开系统提示词**。原站不公开服务端拼接或 provider 请求 body；本次未猜测隐藏提示词。

实际可取得的提示信息全部已保留：

- 原 placeholder、字段说明以及“车辆/动作/环境/镜头/光照”的五项写作指南。
- 文章中的两个对比例句，明确标记为说明片段，不将其包装成原站 preset。
- trim 后最少 12 字符，最大 600 字符；原验证提示文本。
- 一张可选参考图；上传时禁止继续，使用参考图必须确认授权。
- 时长 5–30 秒、步进 1 秒、初始 10 秒；9:16、静音 MP4。480p 是原产品规格，示例视频实际尺寸各不相同。

原客户端流程为可选签名上传、建立订单、Stripe checkout、`/wait/:token`、`/result/:token` 和续生成；这些端点只保留在证据 JSON，展示页不调用它们。私有订单/结果页面不是公开内容页，也没有抓取任何用户订单。

## 媒体完整性

共镜像 **13 文件、9,232,130 bytes（约 9.23 MB）**，均来自公开真实文件，保存于 `public/flyingcar/`，逐文件来源 URL、长度和 SHA256 见 `content/flyingcar-assets.json`。

| 资源 | 本地内容 |
| --- | --- |
| overpass-launch | JPG + MP4，视频 720×1280，约 15.20 秒 |
| thruster-hover | JPG + MP4，视频 576×1024，10.00 秒 |
| downtown-flyby | JPG + MP4，视频 480×854，约 15.04 秒 |
| highway-leap | JPG + MP4，视频 720×1278，约 10.04 秒 |
| 字体 | 原 Anton 与 Archivo 的两个 WOFF2 |
| 品牌/分享资源 | 原 SVG logo、SVG favicon、PNG OG 图 |

四个 MP4 经 `ffprobe` 检查均只有视频流，没有音轨。原 SSR 对下方四视频省略 `src`，迁移时依据同一 bundle 的资源表补齐对应 MP4，并保留原站静音循环播放方式。没有生成近似素材，也没有依赖原媒体域运行。

## 实际改动

1. 删除原美元价格和 1/3/10 视频包；使用 migosai 共享积分及现有定价。时长费用由生成器运行时计算，不把源站价格换算成新的独立价格。
2. 无账号下单、Stripe 邮箱、私有结果链接和原积分永久有效承诺，改为 migosai 登录、共享余额、My Videos 与现有积分条款。
3. HEIC 从展示支持列表移除，匹配现有上传链路的 JPEG/PNG/WebP、10 MB 限制。原始 HEIC 声明仍保存在来源交互 JSON 中作差异证据。
4. 原隐私和条款正文保留为证据，实际法律链接使用项目政策；联系链接改到项目 `/contact`。
5. 原站内部链接改为新功能前缀；保留文章的来源语境外链。
6. CSS 全部限制于 `.flyingcar-page`；与宿主冲突的 8 个语义 class 增加 `fc-` 前缀。keyframes 使用 `flyingcar-` 前缀，注册 CSS properties 使用 `--fc` 前缀，字体重命名为 `Flyingcar Anton` 和 `Flyingcar Archivo`。视觉规则本身沿用原部署 CSS。
7. 原站追踪调用与原 app 初始化代码没有引入。动态 form/FAQ 由本项目组件实现。
8. 按用户后续要求，实际展示使用 migosai 的暖米白背景、深棕文字与橙色强调色。保留 `reference.css` 作为来源，在 `page.css` 与 `generator.css` 使用宿主主题变量覆盖颜色；原布局、字体和媒体保持来源设计。

原文中关于真实世界 Tesla 活动的描述按用户要求保留为站点内容，不代表本次来源迁移独立验证了该新闻主张。隐藏服务端提示词与原站 provider 实现不在已获得的证据中。

## 复建与核验

```sh
python3 scripts/flyingcar-download-assets.py
node scripts/flyingcar-scope-css.mjs /tmp/flyingcar-recon/assets/index-BECjiMG-.css
python3 scripts/flyingcar-import-content.py /tmp/flyingcar-recon
npx vitest run tests/flyingcar-pages.test.ts tests/flyingcar-content-integrity.test.ts
```

内容测试覆盖 3 页结构、17 首页 FAQ、本地媒体路径、源脚本隔离、旧商业承诺清理、CSS 作用域、13 资产 SHA256、156 个非商业原文单元和两份法律来源快照。浏览器视觉与完整生成链路验证属于主任务验收，此文档不将静态测试当作付费生成成功证明。
