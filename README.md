# LobbyDuo

LobbyDuo 是运行于 [migosai.design](https://migosai.design) 的双图视频与音乐生成应用。前端使用 Next.js 15 / React 19，服务端由 OpenNext 部署到 Cloudflare Workers，D1 保存账户、任务和积分账本，R2 保存私有媒体。

## 当前功能

- 英文、韩文、日文、法文、西班牙文、繁体中文六种语言；英文使用无语言前缀路径。
- 登录与注册共用新版品牌卡片，支持 Google OAuth、Google One Tap 和邮箱密码注册/登录；密码使用带随机盐的 scrypt 保存。
- 注册和 Google 登录不赠送积分，新账户余额为 0；生成需购买现有一次性积分套餐，历史余额与赠送记录保留并可继续使用。
- 视频支持 Wan 3.0、Seedance 2.0、Seedance 2.0 Fast，以及四种舞台、画幅、时长、清晰度、动作和声音设置。模型不兼容的组合由界面联动调整，服务端再次校验。
- 浏览器裁剪、预览并转码自选动作或歌曲，服务端核验文件、时长及所有权。参考素材影响生成结果，不保证逐帧动作或逐样本音频复制。
- 新视频使用 Kie；音乐及切换前的历史视频任务保留 APIMart 路径。视频通过 SeeAPI 审核后才开放读取。
- 四档一次性积分包支持 Stripe 托管 Checkout。通过 `PAYMENT_PROVIDER=stripe`、固定 Price ID 与服务端 Secrets 配置启用；签名通知和服务端付款复核通过后才幂等发放积分。历史 Waffo 订单与回调保留。用户已创建 LobbyDuo 独立 Stripe 正式账户及独立 sandbox；正式账户状态页已核实：账户代表身份证明任务于 2026-10-03 完成，已激活任务为空，Payments 与 Payouts 均活跃，原支付即将暂停提示已消失；Cartes Bancaires 支付仍暂停。LobbyDuo 独立正式账户的四档一次性 USD Product/Price 已建立并逐项核实，四个 live Price 已填入本地 `wrangler.jsonc`，映射见[配置与维护指南](REPLACE_GUIDE.md#stripe-配置与收款验收)。沙盒 Product/Price 仅用于隔离测试。正式受限 API Key 与 Webhook Secrets 已配置，本站正式 Webhook 已启用；此前品牌版本 C `47972888-26cc-4ae2-b82f-34d5571c5082` 已于 2026-10-03 约 21:38（Asia/Shanghai）发布到 100% 流量，包含 Stripe 新 Checkout 和 LobbyDuo 网站品牌。生产 Google 登录、Starter 正式 Checkout 创建及取消回跳已验收通过；尚未输入卡信息或实际扣款，真实收款和生产到账尚未验收。
- 服务条款、隐私、退款和内容使用政策公开说明肖像授权、模型来源及现有审核流程；客服和举报邮箱为 `support@migosai.design`。未使用积分包可在购买后 14 天内申请退款，已确认失败的生成返还积分。
- 品牌为 LobbyDuo。“Migos AI” 只作为潮流搜索词出现在首页标题、H1 和说明中；页脚、服务条款、联系页（`/contact`）与 `llms.txt` 声明本站与 migosai.com、Migos、Quavo、Takeoff、COLORS 均无关联。购买需年满 18 岁。
- 首页、`/showcases` 和 Hotel Lobby 生成器页的 “Made with LobbyDuo” 示例只使用本站生成的视频（`content/own-examples.ts`、`public/videos/lobbyduo/`）。原先从 migosai.com 下载的 9 条示例与生成器预览片、以及 10 条 YouTube 名人/版权角色视频已移出公开目录，本地归档在被忽略的 `.local-evidence/removed-public-media/`。示例和内置 Hotel Lobby 模板动作/配乐（`public/templates/hotel-lobby/`）均于 2026-10-03 用 Seedream 4.0 生成的原创动物角色照片和 Wan 3.0 重新生成，来源记录见 `docs/media-sources.json` 与模板 README；来源不明的旧模板已归档。其余第三方示例保留来源链接，并标注“非 LobbyDuo 制作”。
- `/showcases#seedance-examples` 另展示 2026-10-04 复测成功的两条带声音样片：Seedance 2.0 纯文字生成的柯基录音室短片，以及 Seedance 2.0 Fast 双图生成的巴哥与浣熊街头表演。复用已有输出，不新增生成费用；模型样片与首页的 Hotel Lobby 模板成果分开展示。

默认视频为 Wan、Hotel Lobby、10 秒、480p、9:16，使用模板时消耗 60 积分；5 秒 480p 模板消耗 30 积分。最终价格以服务端验证后的参数和参考片段时长为准。新账户需先购买现有一次性积分套餐；已有余额不足时也需购买积分后生成。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm ci
npm run dev
```

页面开发服务位于 `http://127.0.0.1:3000`。验证真实 Workers、D1 与 R2 行为时，将 [`.env.example`](.env.example) 复制为被忽略的 `.dev.vars` 并填写本地配置，然后运行：

```bash
npm run db:local
npm run preview
```

只有公开页面展示可在缺少服务配置时独立预览；登录、生成和支付需要对应服务。未配置的接口返回明确错误。

## 验证与部署

```bash
npm test
npm run typecheck
npm run cf:build
```

2026-10-04 12:25（Asia/Shanghai）示例视频自动播放已随版本 `07a9b886-5d9e-421d-b629-7adc4e2a97d8` 上线：卡片进入视野后静音循环，离屏暂停，点击保留有声弹窗。751 项测试、类型检查、构建及浏览器播放回归通过。

2026-10-04 12:08（Asia/Shanghai）完整首页首屏已随版本 `bbc43d46-c9b6-4f45-8b3e-009bd3b1b28f` 上线：按参考截图复刻标题、按钮与四张倾斜视频卡片，橙色背景连续覆盖下方生成器和预览。桌面/手机页面、751 项测试、构建和正式站多语言检查通过；现有登录、支付与生成逻辑保留，验证边界见 [QA 说明](QA/README.md)。

2026-10-04 11:24（Asia/Shanghai）全站主体配色已随版本 `cb301a6d-19f4-4c46-a7e2-8ab9ed46b4b7` 上线：采用参考站的暖米白、深棕和橙色，仅变更五个 CSS 文件，功能代码未动。751 项测试、类型检查、构建和正式站多语言检查通过；详见 [QA 说明](QA/README.md#2026-10-04-参考站主体配色已上线)。

2026-10-04 10:44（Asia/Shanghai）新版登录界面、邮箱密码注册及 Google One Tap 已随最终版本 `50b12c04-5310-4182-8f59-3d31d3278077` 发布到 100% 流量。生产迁移已完成，751 项测试、类型检查和 Cloudflare 构建通过；线上邮箱流程及真实 Chrome One Tap 登录均已验收。发布时发现的 Workers 公钥请求兼容问题已修复并补回归测试；记录见 [QA 说明](QA/README.md#2026-10-04-登录界面邮箱注册与-google-one-tap已上线)。

2026-10-04 09:57（Asia/Shanghai）取消注册赠送积分已随版本 `93f815e8-b3d3-4d56-a0ca-cc1644fbbe65` 发布到 100% 流量，保留一次性积分套餐、历史余额和已上线的登录预览修复。独立发布源码通过 692 项测试、类型检查及 Cloudflare 构建；正式站 126 个多语言页面和 90 个 sitemap URL 检查通过。发布记录见 [QA 说明](QA/README.md#2026-10-04-取消注册赠送积分)。

2026-10-04 09:32（Asia/Shanghai）视频预览改版已随版本 `4d0f619f-195e-4fb1-b95a-fe0d8efc3853` 发布到 100% 流量。发布源码通过 680 项测试、类型检查及 Cloudflare 构建；正式站通过 126 个多语言页面、90 个 sitemap URL、主视频播放、设置联动和手机布局检查。支付、数据库、媒体绑定与九项 Secrets 保留；本轮未发起付费生成或付款。详细记录见 [QA 说明](QA/README.md#2026-10-04-视频预览改版)。

可复现检查和浏览器验收步骤见 [QA 说明](QA/README.md)。2026-10-03 本轮整理前的验证基线为 550 项自动测试及类型检查通过；三个模型的真实生成和浏览器播放已通过。Chrome 下载到本地文件仍未验收通过，不能据此宣称完整下载链路可用。测试数量记录对应当时的源码，后续以重新执行结果为准。

2026-10-03 Stripe 真实沙盒验收通过：Starter 测试卡付款后余额从 0 增至 300，只有一条 payment 账本；Dahlia 支付事件自动送达及 Dashboard 手动重发均返回 HTTP 200，重放后账本保持不变。Creator 取消支付回跳成功，订单仍为 pending，余额与账本未变化。本轮 `npm run cf:build` 通过；正式 Secrets 与 Webhook 已配置，新版本已发布到 100% 流量；生产 Google 登录、Starter 正式 Checkout 创建及取消回跳已验收通过；尚未输入卡信息或实际扣款，真实收款和生产到账尚未验收。

此前支付版本 B 的生产验收中，Starter 正式收银台显示 Live mode、USD 9.90 / 300 积分；取消后返回定价页并显示取消提示，余额保持 50。针对该订单的 D1 精确只读核验为 pending、payment 账本 0 条、发放积分 0。正式 Stripe 回调对无签名 `{}` 返回 HTTP 401，正常拒绝无效请求。六语言共 30 个定价/政策页面均返回 HTTP 200，sitemap 的 84 个 URL 包含上述 30 项，语言 alternates、客服邮箱、政策及积分包视频数量估算（10/40/73/166）核验正确。上述检查均未发生真实扣款。

用户已明确确认统一使用 LobbyDuo，并要求 Stripe 同步更名。Stripe 正式及 sandbox 品牌更名已完成；网站六语言、SEO、图标和截图等品牌变更已随此前品牌版本 C `47972888-26cc-4ae2-b82f-34d5571c5082` 于 2026-10-03 约 21:38（Asia/Shanghai）发布到 100% 流量，发布命令退出码为 0。重新执行 `npm run cf:build` 通过，包含 lint 和类型检查；品牌兼容性审查通过，域名、Price、认证 cookie 和 `metadata.app=migosai` 保持不变。C 与 B 的变量及非 Secret 绑定完全一致，九项 Secrets 全部保留。版本 C 最终品牌 HTTP 验收通过：31 个页面（首页及六语言的定价页和四类政策页）全部返回 HTTP 200，title 与页首均为 LobbyDuo，无旧品牌页首；Stripe 说明、四档价格、视频数量估算 10/40/73/166 及 support 邮箱保留。浏览器刷新后保持登录，余额仍为 50，公开定价页显示 LobbyDuo；本轮没有实际扣款，真实收款和到账仍未验收。

部署配置位于 [`wrangler.jsonc`](wrangler.jsonc)，密钥使用 Workers Secrets；不把 `.dev.vars`、账户截图、原始订单或生产检查日志提交到 Git。迁移、发布和支付验收步骤见 [配置与维护指南](REPLACE_GUIDE.md)。

**禁止发布旧暂存版本 `2b9793c9-813a-4392-aea8-0595795f9ea6`**：该版本已上传但未部署，包含已弃用的 Shortsmonkey 账户价格。完成独立账户配置后，必须重新构建并上传替代版本，再核对新版本后发布。

## 代码入口

| 路径 | 用途 |
| --- | --- |
| `app/`、`components/` | 公开页、账户页、交互和 API 路由 |
| `content/`、`lib/i18n/` | 页面内容、六种语言、路由与翻译 |
| `lib/video-options.ts` | 视频参数、兼容规则与报价 |
| `lib/server/` | 认证、积分、付款、生成、审核与媒体 |
| `migrations/` | D1 数据库迁移 |
| `public/templates/hotel-lobby/` | 内置动作与声音参考素材及来源说明 |
| `tests/`、组件旁的 `*.test.*` | 自动化回归测试与合成素材夹具 |
| `scripts/check-geo.py`、`scripts/check-i18n.mjs` | 只读页面与抓取检查 |

维护决策见 [NOTES](NOTES.md)，实现范围见 [范围说明](docs/replica-scope.md)，已知验收边界见 [交付审计](CLONE_AUDIT.md)。
