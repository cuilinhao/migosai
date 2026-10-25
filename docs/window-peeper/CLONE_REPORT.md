# Window Peeper 原站参考与本站重构验收报告

日期：2026-10-25。目标路由：`/window-peeper-ai-video-generator`。

本次交付为保留 MigosAI 主题的原生内页重构：沿用参考站的内容节奏和双栏生成结构，将功能接到本站已有账户、积分、生成、审核、存储与套餐系统。本地实现、自动检查和独立代码审查通过。真实付费出片与生产部署未执行。

## 来源与路径

参考站为 [windowpeeper.net](https://windowpeeper.net/)。侦察使用其公开部署 HTML、页面 JS/CSS、真实素材响应和原站截图；没有将推测代码作为源码证据，也未把原站 bundle、登录或购买系统作为本站依赖。

结构化记录见 [design-dna.json](./RECON/design-dna.json)。原站与本地在 1440 × 900 视口的 DOM 探针分别为 [original-recon.json](./RECON/original-recon.json) 和 [clone-recon.json](./RECON/clone-recon.json)，记录正文计算样式、标题层级、媒体数量和样式表。原站 body 为浅色背景 / Inter，本站 body 为 `#0b0b0b` / DM Sans；原站页面 CSS 另声明 Nunito，未取得具体标题节点计算字体时不推定它等同于 body 字体。

展示层按 L3 内容前端范围重建；账号和支付等业务能力复用已有系统。原站仓库及许可证未确认，外部素材保留来源与作者链接，清单见 [asset-manifest.json](./asset-manifest.json)。仅有素材公开可访问这一事实，不能视为再发布授权。

## 原站与本站对比

| 维度 | 原站参考 | 本站实现与取舍 | 证据 |
|---|---|---|---|
| 信息架构 | Hero、双栏生成区、三步骤、主案例/画廊、套餐、FAQ、CTA | 保留同一主要区块顺序，加入本站模板参数与明确来源说明 | `page-content.tsx`、原站截图 |
| 页面外壳 | 白色页面、原站顶栏与紫色强调 | 现有 PortalShell、黑底/深灰卡片、紫粉渐变；主题差异是用户要求 | `window-peeper.module.css`、本站预览 |
| 生成操作 | 参考站自身的设置、模型和账户行为 | 一张照片、明确同意、固定 MiniMax H3 / 15s / 768p / 9:16 / 300 积分 | `generator.tsx`、`lib/window-peeper.ts` |
| 参考片 | 原模板及外部潮流案例 | 本地可播素材、作者链接、来源披露；参考片与真实结果使用不同展示状态 | `asset-manifest.json`、视频播放检查 |
| TikTok | 外部作者案例 | 本地海报连接作者原帖；不引入原站账号状态 | `content/window-peeper.ts` |
| 套餐 | 参考站自有价格与购买服务 | 直接复用本站 PricingEntry / PricingCards；保留积分包及订阅流程 | `page-content.tsx`、`credit-packs.jpg` |
| 任务与作品 | 原站账户下的生成记录 | 本站幂等预留、worker、审核、失败退款、私有 R2 与 My Videos；按模板恢复 | 后端/提交/作品库测试与独立审查 |
| 国际化与 SEO | 原站语言与路由机制 | 本站六语言路由、localized-link、canonical、title、lang 与 sitemap | `http-checks.json`、发现入口测试 |
| 响应式 | 原站桌面/平板/手机截图 | 根据本站侧栏和移动布局重新适配，实际视口与截图记录见下 | RECON 截图 |

不提供像素相似度百分比或视觉评分：本次主动保留本站视觉体系，未运行像素差异测量。源证据、结构、交互、响应式、功能、内容替换和素材边界按下面的具体证据判断，不能将通过自动测试等同于外部生成质量已验证。

## 自动检查

| 检查 | 实际结果 |
|---|---|
| 全套 Vitest | 112 个测试文件、1899 项测试通过 |
| TypeScript | `npm run typecheck` 通过 |
| Next.js 构建 | `npm run build` 通过，构建输出包含新 API 和页面 |
| Diff 格式检查 | `git diff --check` 通过 |
| 真实本地 HTTP | 六语言新页、`/`、`/tools` 共 8 条路由均 200，均单 H1 |
| 六语言 metadata | `en / ko / ja / fr / es / zh-TW` 的 title、lang、canonical 正确；标题品牌后缀无重复 |

HTTP 原始记录：[RECON/http-checks.json](./RECON/http-checks.json)。本次运行的测试与构建日志在 `/tmp/migosai-window-peeper-recon/final-tests.log` 和 `/tmp/migosai-window-peeper-recon/build.log`，临时路径不保证跨环境保留。

新增测试覆盖账户/图片归属、同意、服务端固定配置、同键重试、余额不足、provider 请求映射、worker 并发、审核隔离、结果保存与唯一退款，以及客户端上传缓存、取消与账户变化防护。provider 测试使用模拟响应，没有产生真实付费调用。

## 浏览器实测

| 操作 | 已确认结果 | 边界 |
|---|---|---|
| 原模板播放 | `readyState=4`，时长 8.2 秒，视频 720 × 1280 | 来源参考片，不是本站新生成视频 |
| 猫咪案例播放 | `readyState=4`，时长约 10.041667 秒，视频 720 × 414 | 外部潮流案例 |
| 匿名选图 | 选择本地公开 poster 后显示缩略图和文件名 | 仅浏览器预览，未向账户上传私人照片 |
| 生成按钮 | “Generate my video · 300” 打开既有 MigosAI 登录弹窗；关闭弹窗后本地选择仍保留 | 未完成真实 OAuth 登录或付费生成 |
| 移除照片 | 恢复空上传区 | 未删除服务器对象 |
| FAQ | 宠物问题可以展开，内容正确显示 | 仅本地交互验证 |
| Credit packs | 切换后显示本站 $9.90/300、$29.90/1200、$49.90/2200、$99.90/5000 积分包 | 本次界面快照；未提交 checkout |
| 响应式 | 实际 `innerWidth` 为 1440、768、390px，三档 `scrollWidth` 均与视口宽度一致 | 最终使用本地标签页 CDP Emulation 核准，未把截图文件名当成视口证据 |
| 手机参数框 | 标题换行后四个参数框顶部均为 691.617px | 局部 CSS 改为 flex 列及 `dd` 的 `margin-top: auto`；生成逻辑不变 |
| 浏览器日志 | 未发现新页应用异常；出现现有 Google FedCM 本地网络失败提示 | 不宣称 console 零错误或 Google 登录已通过 |

## 截图证据

原站已有 [1440 档截图](./RECON/original-1440.jpg)、[768 档截图](./RECON/original-768.jpg)、[390 档截图](./RECON/original-390.jpg) 和 [桌面原图](./RECON/original-desktop.jpg)。本站交互证据为 [选图预览](./RECON/upload-preview.jpg)、[登录弹窗](./RECON/sign-in.jpg)、[积分包](./RECON/credit-packs.jpg)。

本站最终截图如下，实际视口已独立核准，三个完整页面截图宽度也已通过文件属性复核。

| 截图 | 最终图像尺寸 | 用途 |
|---|---|---|
| [clone-1440.jpg](./RECON/clone-1440.jpg) | 1440 × 6696 | 桌面完整页面，与原站 1440 档对照 |
| [clone-768.jpg](./RECON/clone-768.jpg) | 768 × 6589 | 平板完整页面 |
| [clone-390.jpg](./RECON/clone-390.jpg) | 390 × 13576 | 手机完整页面 |
| [preview-desktop.jpg](./RECON/preview-desktop.jpg) | 1440 × 1100 | 桌面首屏、双栏生成区和 PortalShell |

## 独立审查

后端审查通过，核对了恶意或外账号图片被拒绝、服务器拥有价格和 provider 配置、数据库幂等扣费、worker 租约、未知付费提交不重复发送、私有审核隔离、确定失败唯一退款及旧模板兼容。

完整集成审查通过，核对了前端同键重试和余额变化、账户切换时旧响应不写回、模板历史恢复、共享套餐、六语言路由与作品库映射。审查发现的登录提示问题已修正：六语言仅说明登录后使用 MigosAI 积分生成，移除了 Google OAuth 全页跳转后照片一定保留的承诺。

审查记录位于 `/tmp/migosai-window-peeper-recon/backend-review.md` 与 `/tmp/migosai-window-peeper-recon/full-review.md`；其静态审查边界在本报告中保留。

## 未执行与保留边界

- 未调用真实付费视频生成，未验证成片身份保持、动作还原或音画质量；页面案例不能作为这些能力已成功执行的证据。
- 未进行真实购买、充值、生产账本退款或真实 OAuth 全流程；已有实现的模拟测试和代码审查已通过。
- 未部署生产，也未复制或改造原站后端。新参考视频在实际生成环境必须能通过本站 APP_URL 被 provider 读取。
- 未测量像素相似度，未声称零控制台错误；外部素材和原站许可状态未被推定为已授权。

当前适合本地审查与预览。是否执行真实付费验证或生产部署属于后续独立操作。
