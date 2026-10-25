# Window Peeper 原生内页重构笔记

> 本文为开发阶段历史记录，保留当时的验证范围。最新 GitHub 推送、正式上线与线上验收状态见 [RELEASE.md](./RELEASE.md)；本轮仍未执行真实付费生成或付款。

记录日期：2026-10-25。代码基线：`baf39fe`。本次在 MigosAI 现有项目新增 `/window-peeper-ai-video-generator`，交付本地代码与预览，未部署生产。

## 来源与实现范围

页面结构参考 [windowpeeper.net](https://windowpeeper.net/) 的主标题、双栏生成区、三步说明、视频案例、TikTok 参考画廊、套餐、FAQ 和末尾 CTA。原站公开部署的 HTML、`windowpeeper-CkEbJDHc.js`、`windowpeeper-KtYNhF1k.css` 及浏览器截图用于侦察；原始抓取位于本次工作目录 `/tmp/migosai-window-peeper-recon/`，原站截图保存在 [RECON](./RECON/)。未获得可确认许可的原站源代码仓库，也未确认外部素材的再发布授权；页面保留外部作者与来源说明，此记录不构成授权证明。

这次采用内容前端原生重构路径：展示层按 L3 范围处理；账号、权限、计费、支付与生成服务属于业务系统范围，复用 MigosAI 现有实现。没有移植原站登录、购买、服务端 API 或追踪脚本，也没有把原站打包脚本嵌入本站运行时。本站已有统计和认证机制保持原状。

用户已批准的约束是保留现有黑底、深灰卡片、紫粉品牌色及 PortalShell，并接入真实本站生成与积分系统。因此本次是参考信息结构的品牌内页，不以逐像素镜像为目标。新增样式使用 CSS Module 和现有主题变量；未更改全局主题定义或替换首页正文。

设计依据：[Window Peeper 设计](../superpowers/specs/2026-10-25-window-peeper-design.md)。结构化视觉记录见 [design-dna.json](./RECON/design-dna.json)，其中明确区分来源观察、本站实现和未知项。详细对比、检查结果与截图索引见 [CLONE_REPORT.md](./CLONE_REPORT.md)。

## 素材

完整来源、字节数、SHA-256 和已测媒体属性见 [asset-manifest.json](./asset-manifest.json)。目前记录 15 个本地文件：3 段视频、3 张主案例海报与 9 张 TikTok 海报。

| 本地文件 | 来源 | 用途与已知属性 |
|---|---|---|
| `public/templates/window-peeper/motion.mp4` | [Theolicccc / CapCut 原模板](https://www.capcut.com/template-detail/7698670250123922694) | 固定动作参考及页面预览；8.2 秒，720 × 1280，H.264/AAC |
| `public/window-peeper/original-poster.jpg` | 同一 CapCut 原模板 | 原模板海报 |
| `public/window-peeper/burger.{jpg,mp4}` | [Viberot](https://viberot.com/video/window-peeper-ai) | 外部潮流案例；视频约 10.041667 秒，414 × 720 |
| `public/window-peeper/cat.{jpg,mp4}` | [Viberot](https://viberot.com/video/window-peeper-ai) | 外部宠物案例；视频约 10.041667 秒，720 × 414 |
| `public/window-peeper/*.avif` | manifest 中逐条列出的 TikTok 原作者页面 | 海报跳转到原帖，未伪装为本站作品 |

原模板下载文件为 HEVC，为浏览器播放兼容转成 H.264/AAC 并启用 faststart；画幅、8.2 秒时长和参考动作保持不变。manifest 同时记录转换前后哈希。页面明确区分 8.2 秒来源预览与 15 秒生成规格；这些参考片不能证明 MigosAI 已真实生成相同效果。

## 本站生成与计费

固定设置由 `lib/window-peeper.ts` 定义：MiniMax H3、15 秒、768p、9:16、300 积分，provider 为 fal 的 `minimax/h3/reference-to-video`。页面显示固定参数，不提供未实现的模型或规格选项。

1. 浏览器选择一张 JPEG、PNG 或 WebP，使用既有图片准备和上传流程；图片最大 10 MB。
2. `POST /api/window-peeper/generations` 接收照片 key、明确同意和幂等键。服务器验证同源请求、账户、照片路径与数据库归属、MIME、R2 对象和大小；价格、模型、提示词、模板与参考视频均由服务器决定。
3. 现有 `reserveGeneration`、D1 唯一约束与账本触发器预留积分；订阅余额、永久积分分配和退款沿用本站逻辑。同一次未知结果重试保留请求键和已上传照片。
4. 现有任务 worker 以租约推进，提交单张签名照片与本站固定参考视频；未知付费提交结果进入人工核查，不自动再发一次付费请求。
5. provider 完成后先存入私有 R2，再进入现有视频安全审核。只有通过审核、结果 key 与 ETag 匹配时才向用户提供播放/下载。确定失败及审核拒绝使用现有退款流程。
6. 历史响应携带 `template: 'window-peeper'`。生成器只恢复这一模板的未完成任务；作品库显示 Window Peeper 并返回对应生成器，已完成视频通过现有 My Videos / Assets 查看和下载。

套餐区直接使用现有 `PricingEntry` / `PricingCards`，继续使用同一订阅、积分包、活动参数和结账入口。本次没有新建支付方案或复制参考站价格。

## 文件替换地图

| 要调整的内容 | 文件 |
|---|---|
| 页面区块、参考案例、FAQ、套餐和 CTA | `components/window-peeper/page-content.tsx` |
| 选图、同意、登录入口、上传、提交、进度、恢复和结果 | `components/window-peeper/generator.tsx` |
| 一次提交的快照、上传缓存和取消检查 | `components/generator/window-peeper-submission.ts` |
| 六语言页面文字与来源链接 | `content/window-peeper.ts` |
| 局部布局与响应式样式 | `components/window-peeper/window-peeper.module.css` |
| 固定参数和价格 | `lib/window-peeper.ts` |
| 场景提示词 | `lib/prompts/window-peeper.ts` |
| API 校验和积分预留 | `lib/server/window-peeper.ts`、`app/api/window-peeper/generations/route.ts` |
| provider 提交与共享任务推进 | `lib/server/fal.ts`、`lib/server/jobs.ts` |
| SEO、六语言路由与公开页登记 | `app/window-peeper-ai-video-generator/page.tsx`、`app/[locale]/[[...path]]/page.tsx`、`content/public-pages.ts` |
| 发现入口和作品库标识 | `components/generator-menu.tsx`、`content/portal.ts`、`components/portal/portal-shell.tsx`、`components/account/asset-card.tsx`、`components/generator/generation-history.ts` |

文字使用现有 `en / ko / ja / fr / es / zh-TW` 语言机制；页面 metadata 调用 `localizeMetadata`，标题采用 `absolute` 避免重复附加 MigosAI，内部页面链接沿用 localized-link。

## 本地运行

项目使用 Next.js 16.4.2、React 19、TypeScript、CSS Modules、Cloudflare D1/R2 和现有 OpenNext 配置；`package.json` 要求 Node.js 22 或以上。

```sh
cd '/Users/pgy/Desktop/Copy Saas/migosai'
npm run dev
```

默认预览：[Window Peeper](http://127.0.0.1:3000/window-peeper-ai-video-generator)。已有监听进程时复用它或按本地环境调整端口。公开页面可独立渲染；真实账户、上传、付费生成需要已有环境绑定和服务配置，文档不包含密钥。

## 验证状态与边界

最终自动检查：112 个测试文件、1899 项测试通过；`npm run typecheck`、`npm run build`、`git diff --check` 通过。真实 HTTP 核查 8 个路由均为 200 且单 H1，其中六语言新页的 title、lang、canonical 正确，另检查根首页与 `/tools`。原始数据见 [http-checks.json](./RECON/http-checks.json)。

浏览器已确认原模板和猫咪案例播放、匿名图片选择预览、既有登录弹窗打开/关闭、移除照片、宠物 FAQ 展开和既有 Credit packs 切换。选图验证使用本地公开 poster，未向账户上传私人照片。日志观察到现有 Google FedCM 本地网络失败提示，未发现新页应用异常，不能据此宣称 console 零错误。

响应式最终用实际浏览器视口核对：1440、768、390px 三档的 `innerWidth` 分别与 `scrollWidth` 一致，无横向溢出。最终截图已保存；手机参数标题换行后，使用 flex 列布局与 `dd` 的 `margin-top: auto` 使四个参数框顶部对齐，实际测得四个 `top` 均为 691.617px。这次微调仅涉及局部 CSS，未改变生成逻辑。

独立后端及完整集成审查均通过。唯一发现为 Google OAuth 全页导航不能保证保留内存照片，六语言登录提示已删除无条件保留照片的承诺；邮箱弹窗路径和现有 Google 跳转机制保持不变。

未执行真实付费 provider 出片、真实支付/充值、线上退款、真实 OAuth 全流程或生产部署。测试中的成功/失败 provider 响应为模拟数据；本次没有可声称已实际生成的 MigosAI 成片，也未测量或报告像素相似度。
