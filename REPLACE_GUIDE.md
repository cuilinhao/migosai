# 配置与维护指南

## 环境配置

以 [`.env.example`](.env.example) 为变量清单。开发使用被 Git 忽略的 `.dev.vars`；生产密钥使用 Cloudflare Workers Secrets。`DB`、`MEDIA`、`ASSETS` 和 Worker 自引用是 Wrangler 绑定，不是环境变量中的凭据字符串。

| 配置组 | 用途 |
| --- | --- |
| `APP_URL`、Google OAuth | 正式站点源地址与登录回调 |
| `MEDIA_SIGNING_SECRET` | 私有媒体短期签名，至少 32 字符随机值 |
| `KIE_API_KEY`、`KIE_MEDIA_HOSTS` | 新视频生成及输出 CDN 允许列表 |
| `APIMART_API_KEY`、`APIMART_MEDIA_HOSTS` | 音乐和历史视频任务 |
| `SEEAPI_API_KEY` | 视频发布前的内容审核 |
| `WAFFO_*` | 商户、店铺、四档商品、环境及商户 RSA 私钥 |
| `PAYMENT_PROVIDER` | 新订单支付商；正式切换时设为 `stripe`，历史回调独立保留 |
| `STRIPE_MODE`、`STRIPE_PRICE_*` | `test` / `live` 模式与四档一次性 USD Price ID |
| `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET` | 服务端 API 凭据和本站 Stripe Webhook 签名密钥，使用 Workers Secrets |

生产 `APP_URL` 必须使用可公开访问的 HTTPS 源地址，供服务商读取参考素材。媒体 CDN 仅加入服务商实际返回且核实过的精确主机名。Waffo 沙箱和生产使用各自的密钥，`WAFFO_MODE` 必须与目标环境一致。

## 数据库与发布

1. 安装锁定依赖并运行 `npm test`、`npm run typecheck`、`npm run cf:build`。
2. 检查 `wrangler.jsonc` 的账户、D1、R2、路由和环境是否属于本次目标；生产配置含站点专用资源 ID，复制工程时需替换。
3. 新环境执行本地迁移 `npm run db:local`。生产发布前检查远端待执行迁移及备份，再用 `npm run db:remote` 应用缺少的迁移。声音与动作功能依赖 `0005_reference_uploads.sql`；邮箱注册及 One Tap 依赖 `0006_email_and_one_tap_auth.sql`。
4. 在确认的源码版本运行 `npm run deploy`，记录提交和发布版本。以 [QA 说明](QA/README.md) 核查线上页面、认证、媒体访问及关键交互。

保留已有任务、积分账本及历史付款记录。不要把忽略目录中的凭据、数据库转储、原始日志或真实账户截图放入发布源码。

## 邮箱登录与 Google One Tap

2026-10-04 已完成生产迁移和发布，最终版本为 `50b12c04-5310-4182-8f59-3d31d3278077`；正式源地址、邮箱注册/登录及真实 Chrome One Tap 均已核验。Google 公钥请求须使用 Workers 支持的 `redirect: 'manual'`，并拒绝非成功状态；不可改回 `error`。详见 [QA 记录](QA/README.md#2026-10-04-登录界面邮箱注册与-google-one-tap已上线)。

登录弹窗和独立 `/sign-in`、`/sign-up` 页面共用界面，支持六种语言。邮箱注册使用 8–128 字符密码，服务端通过带随机盐的 scrypt 保存密码哈希；注册成功后建立现有 HttpOnly 会话，新账户积分为 0。邮箱不发送验证邮件，也没有密码找回流程。同一邮箱不能自动合并到 Google 账户；已有 Google 用户继续使用 Google 登录，避免未验证邮箱账户取得他人账户权限。

One Tap 使用现有 `GOOGLE_CLIENT_ID`。发布前，在该 Google Web OAuth 客户端的 **Authorized JavaScript origins** 中确认包含 `https://migosai.design`；本地验证需要加入实际本地源地址。保留现有 **Authorized redirect URI** `https://migosai.design/api/auth/callback/google`，供常规 Google 按钮回退使用。客户端不读取 `GOOGLE_CLIENT_SECRET`。配置方式见 [Google 官方设置文档](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)。

`/api/auth/google/one-tap` 的 GET 返回客户端 ID 与短期 nonce，POST 在服务端校验 Google RS256 签名、发行方、受众、有效期、邮箱验证状态和一次性 nonce 后建立会话。同一标签页会话最多自动提示一次，退出后不会立即再次提示；浏览器抑制提示或 Google 脚本不可用时，可继续使用常规 Google 按钮或邮箱表单。

迁移 0006 增加密码凭据、nonce 和限流表，以及阻止新大小写重复邮箱的触发器，不改动旧用户、会话或积分。发布前先应用迁移，再部署构建并验证真实 Google 账号。自动化验签测试与本地邮箱测试不能替代 Google 控制台源地址授权和线上 One Tap 握手验收。

## Waffo 正式收款验收

目前商户配置、四档商品和 Webhook 已配置；沙箱付款、签名通知及幂等入账已验证。正式创建付款仍因商户审批返回 403，尚无生产交易验收。

商户审批通过后，复核 `WAFFO_MODE=prod`、价格、积分和商品状态，再从正式站点创建新的 Checkout。完成交易后核查签名回调、金额与商品绑定、积分只入账一次，以及重复通知和退款人工核对路径。付款回跳参数和接口拒绝未签名请求都不能代替真实交易验证。

回调入口为 `/api/webhooks/waffo`，处理 `order.completed`、`refund.succeeded`、`refund.failed`。旧 Creem 路由已移除，历史订单保留；旧服务商后台 Webhook 是否已删除需另行核查。

## Stripe 配置与收款验收

新订单使用 Stripe 托管 Checkout，继续销售四档一次性积分包，不创建订阅：Starter 为 USD 9.90 / 300 积分，Creator 为 USD 29.90 / 1200 积分，Pro 为 USD 49.90 / 2200 积分，Business 为 USD 99.90 / 5000 积分。`STRIPE_PRICE_STARTER`、`STRIPE_PRICE_CREATOR`、`STRIPE_PRICE_PRO`、`STRIPE_PRICE_BUSINESS` 必须指向对应模式下的固定一次性价格。

2026-10-03 用户已自行提交 LobbyDuo 独立 Stripe 正式账户 `acct_1UMOG79IlL4CIeBl` 的入驻资料；Dashboard 设置指南显示“激活 Payments”已完成。最新账户状态页已核实：已激活任务为空，账户代表的身份证明任务在已完成页显示于 2026-10-03 完成；Payments 与 Payouts 均为活跃，原 HK$78,471 即将暂停提示已消失，仅 Cartes Bancaires 支付仍显示暂停。身份任务完成及账户功能活跃不等于真实收款或生产到账已经验收。Stripe 自动建立的独立测试沙盒为 `acct_1UMOGF9oKY54JoaI`，显示名为 LobbyDuo 沙盒（LobbyDuo）；沙盒的测试密钥和 Product/Price 属于该 sandbox 账户，不能作为正式账户的 live 配置使用。此前复用 Shortsmonkey 账户的方案已取消，其 Product/Price 不得用于 LobbyDuo；本指南已移除旧映射，避免误用。

2026-10-03 已完成真实沙盒支付验收，证据保存在 Git 忽略目录 `.local-evidence/stripe-isolated-test/`。测试使用独立 sandbox、本地 D1/R2 和合成用户，不读取生产 `.dev.vars` 或连接生产数据库：Starter 测试卡付款完成，订单变为 paid，余额从 0 增至 300，仅产生一条 payment 账本；Dahlia 支付事件自动送达及 Dashboard 手动重发均返回 HTTP 200，付款与重放审计通过，重放前后账本快照 hash 一致。Creator 取消后返回 `?checkout=cancelled`，订单保持 pending，余额 300、payment 记录 1 均未改变。本轮 `npm run cf:build` 已通过；这些沙盒结果不替代生产真实收款或到账验收。

2026-10-03 已在 LobbyDuo 独立正式账户 `acct_1UMOG79IlL4CIeBl` 的 live 模式中建立并逐项核实以下四档一次性 USD Product/Price；本地 `wrangler.jsonc` 已填入对应 Price，并保留 `PAYMENT_PROVIDER=stripe`、`STRIPE_MODE=live`。这些 ID 仅用于该正式账户，不与 sandbox 混用。

| 套餐 | USD / 积分 | Live Product | Live Price / 配置变量 |
| --- | --- | --- | --- |
| Starter | 9.90 / 300 | `prod_VNCOzCEgLVDTcK` | `price_1UMRzp9IlL4CIeBl9E1a7Qyl`（`STRIPE_PRICE_STARTER`） |
| Creator | 29.90 / 1200 | `prod_VNCPoDajPVzByz` | `price_1UMS0f9IlL4CIeBlkVqz536C`（`STRIPE_PRICE_CREATOR`） |
| Pro | 49.90 / 2200 | `prod_VNCQfnRhwfvtue` | `price_1UMS1N9IlL4CIeBl5K9zRWEy`（`STRIPE_PRICE_PRO`） |
| Business | 99.90 / 5000 | `prod_VNCS8ohENItIfD` | `price_1UMS3X9IlL4CIeBlFNf4NK88`（`STRIPE_PRICE_BUSINESS`） |

正式账户受限 API Key 已创建，仅授予 Checkout Sessions 写入、Prices 读取、Payment Intents 读取三类权限；`STRIPE_SECRET_KEY` 和 `STRIPE_WEBHOOK_SECRET` 已安全写入 Cloudflare 正式发布版本。正式部署和新 Checkout 的 Stripe 切换已完成；生产 Google 登录、Starter 正式 Checkout 创建及取消回跳已验收通过；尚未输入卡信息或实际扣款，真实收款和生产到账尚未验收。缺少有效配置时服务端拒绝创建 Checkout。现有 Waffo 变量、历史回调和 Cloudflare 绑定保持不变。

发布历史：新代码上传版本 A 为 `7e7bd639-d02c-4aba-9188-dde26d8132b1`；补齐 Secrets 并完成独立核对后的版本 B `557ea136-7333-417d-8af2-aeb84aadd569` 已于 2026-10-03 约 21:29（Asia/Shanghai）成功发布到 100% 流量，发布命令退出码为 0。原有七项 Secrets 及资源 bindings 保留，新增两项 Stripe Secrets。生产登录、Starter 正式收银台及取消流程已验收通过；本轮没有真实扣款，不能宣称真实收款或到账已验证。

支付版本 B 发布后的生产浏览器验收：Google 登录成功，原余额为 50；Buy Starter 打开真实 `cs_live` Checkout，显示 Live mode、USD 9.90 / 300 积分，并显示卡、Apple Pay 和 Link 付款选项。未输入卡信息、未付款，点击 Back 后返回 `/pricing?checkout=cancelled&orderId=…`，取消提示正常，余额仍为 50。针对该准确订单 ID 的生产 D1 只读查询确认：Stripe live、pending、USD 990 分 / 300 积分，已记录 live Checkout，payment 账本 0 条、发放积分 0；查询仅读取对应订单，无数据库写入或客户全表查询。

支付版本 B 发布后的正式 `/api/webhooks/stripe` 接收无签名 `{}` 时返回 HTTP 401 和 `Invalid payment webhook signature`，确认部署后的路由正常拒绝无签名请求；这不替代真实已付款生产事件的送达及入账验收。独立 HTTP 核验覆盖六语言共 30 个定价/政策页面，全部 HTTP 200；sitemap 共 84 个 URL，包含本次 30 项，语言 alternates、客服邮箱、政策与视频数量估算（10/40/73/166）均正确。

用户已明确确认统一使用 LobbyDuo，并要求 Stripe 同步更名。Stripe 正式及 sandbox 品牌更名已完成；网站六语言、SEO、图标和截图等品牌变更已随当前线上版本 C `47972888-26cc-4ae2-b82f-34d5571c5082` 于 2026-10-03 约 21:38（Asia/Shanghai）发布到 100% 流量，发布命令退出码为 0。重新执行 `npm run cf:build` 通过，包含 lint 和类型检查；品牌兼容性审查通过，域名、Price、认证 cookie 和 `metadata.app=migosai` 保持不变。C 与 B 的变量及非 Secret 绑定完全一致，九项 Secrets 全部保留。版本 C 最终品牌 HTTP 验收通过：31 个页面（首页及六语言的定价页和四类政策页）全部返回 HTTP 200，title 与页首均为 LobbyDuo，无旧品牌页首；Stripe 说明、四档价格、视频数量估算 10/40/73/166 及 support 邮箱保留。浏览器刷新后保持登录，余额仍为 50，公开定价页显示 LobbyDuo；本轮没有实际扣款，真实收款和到账仍未验收。

**禁止发布 Cloudflare 暂存版本 `2b9793c9-813a-4392-aea8-0595795f9ea6`。** 该版本已通过 `wrangler versions upload` 上传但未部署，包含已弃用的 Shortsmonkey 账户价格。该版本已弃用但仍存在于 Cloudflare，不能通过只补写 Secrets 后发布来沿用。完成独立账户配置后，必须从更新后的源码与配置重新执行 `npm run cf:build` 和 `wrangler versions upload`，上传新的替代版本；核对新版本的四个 Price、模式和绑定，再按正常发布流程配置 Secrets 并发布对应的新版本。发布前核对服务端版本，避免选中旧暂存版本或覆盖其他并行部署。

正式账户已创建并启用本站 Webhook `we_1UMSv49IlL4CIeBlZyrRjzdK`，接收地址为 `https://migosai.design/api/webhooks/stripe`，API 版本为 `2026-08-26.dahlia`。订阅九种事件：`checkout.session.completed`、`checkout.session.async_payment_succeeded`、`charge.refunded`、`refund.created`、`refund.updated`、`refund.failed`、`charge.dispute.created`、`charge.dispute.updated`、`charge.dispute.closed`。正式处理器最初随版本 B 部署，当前版本 C 继续沿用同一回调配置；真实生产付款事件的送达与入账仍待验收。密钥和 Price 必须全部属于同一个 Stripe 账户及同一 test/live 模式。不要把 API 密钥放入客户端、NEXT_PUBLIC 变量、Git 或截图；Webhook 密钥必须来自本站接收端。

服务端以订单创建时的 Price、金额、币种、积分和用户快照核验已付款 Checkout，验签通知与 Stripe 查询均通过后才将订单标记 paid 并幂等发放积分。成功回跳或取消回跳不会单独发积分。退款及争议先记录人工复核，不自动对 Stripe 执行资金操作，也不盲目扣减已经消费的积分。

目前没有退款管理页面或自动复核通知。运营方需在 D1 查询待办，并在 Stripe 后台核对订单、退款及争议状态：

```sql
SELECT e.id, e.event_type, e.order_id, e.note, e.created_at,
       o.user_id, o.amount, o.currency, o.credits, o.provider_order_id
FROM webhook_events e LEFT JOIN orders o ON o.id = e.order_id
WHERE e.review_required = 1 AND e.id LIKE 'stripe:%'
ORDER BY e.created_at;
```

收到客服退款申请后，先核对购买时间、对应订单和该用户的积分流水，不能仅凭当前余额认定积分未使用。退款是否成功以 Stripe 的最终状态为准；重复事件按同一 Stripe 退款/争议对象合并复核。确认需撤回积分时，应使用带唯一业务引用的积分账本调整，并检查并发消费和余额，不能直接覆盖用户余额。完成资金、积分和订单核对后，再保留处理说明并清除对应事件的 `review_required` 标记。争议关闭不等于需要再次退款。

验收时使用测试模式模拟支付并检查签名回调、真实账本变更、重复通知不重复入账、金额和模式不匹配被拒。生产模式至少检查四档实际 Checkout 的币种与价格、公开政策及客服链接；真实扣款须有明确付款授权，未完成真实交易时不得宣称生产到账已验收。

## LobbyDuo 品牌配置

2026-10-03 按用户要求，自有品牌统一为 **LobbyDuo**。网站的导航、账户页、六种语言、SEO、政策文案、下载文件名、L 字标、网站图标及教程截图同步更新。域名 `migosai.design`、客服邮箱、现有路由、认证 cookie、付款 `metadata.app=migosai` 和 Cloudflare 资源名称继续沿用，避免破坏现有连接及历史订单核验。音乐团体 Migos 及相关搜索词的事实说明不作为本站品牌。

正式 Stripe 账户 `acct_1UMOG79IlL4CIeBl` 已在 Dashboard 保存并核验：账户名与公开商家名称为 `LobbyDuo`，对账单描述符及简短前缀为 `LOBBYDUO`；Starter、Creator、Pro、Business 四档商品名称均使用 `LobbyDuo`。既有 Product/Price ID、金额、币种、积分和税务类别不变。账户身份证明完成与正式收款配置状态见上方记录；品牌更名不代表真实收款或到账已验收。

独立 sandbox `acct_1UMOGF9oKY54JoaI` 的账户显示名已改为 `LobbyDuo 沙盒`，公开商家名称为 `LobbyDuo`，对账单描述符及简短前缀为 `LOBBYDUO`；四档测试商品也已更名，保留原价格和 ID。沙盒法定商家名称保留原资料。Stripe 产品编辑表单在保存时将原本继承的预设税码 `txcd_10202000` 显式写入测试商品；仍选择“使用预设”，实际类别与原继承值相同，未修改全局税务设置或正式商品税类。

本轮 666 项测试、类型检查和 Cloudflare 构建通过，截图说明更新后另复核 33 项国际化测试。网站品牌变更现已随版本 C 发布到 100% 流量；发布前再次执行 Cloudflare 构建（含 lint/类型检查）通过，版本 C 的 31 页面品牌 HTTP 验收通过，浏览器登录及 50 积分余额保持正常；真实收款和到账仍未验收。真实账户页面证据位于 Git 忽略目录 `.local-evidence/lobbyduo-rebrand/`，不要将账户截图加入 Git。

## 内容与素材替换

- 公开文案使用 `content/` 和 `lib/i18n/messages/`；同步六种语言、FAQ 结构化数据、canonical、hreflang、sitemap 与 `public/llms.txt`。
- 模板动作与音轨按 [`public/templates/hotel-lobby/README.txt`](public/templates/hotel-lobby/README.txt) 的时长和格式约束替换。
- 视频费用改动需同步服务端报价、控件展示和相关测试。套餐改动需同时核对站内配置与当前支付商商品、价格。
- 法务正文中的运营主体、联系方式、保留期限和退款说明仍需运营方确认后更新。

Chrome 下载到本地文件尚未验收通过。修改播放或下载逻辑时，应分别验证浏览器播放、授权读取和最终文件保存，不能用其中一项代替另外两项。

## 全站主题配色

当前配色依据 `https://hotellobbyvideo.net/` 的实际 CSS 变量，2026-10-04 已上线。统一 tokens 位于 `app/globals.css`：背景 `#fbf6ee`、卡片 `#fffdf9`、正文 `#1d140e`、次要文字 `#5c5047`、分隔线 `#e6d9c6`、强调色 `#e8650f`、深橙色 `#b9460a`。按钮使用 `--brand-gradient`，首页与 CTA 使用 `--stage-gradient`。

生成器、登录、内容页与案例样式分别位于 `interactive.css`、`auth.css`、`geo.css`、`video-examples.css`。后续调整尽量复用变量；深色媒体预览内的浅色文字、Google 官方四彩图标和代表场景的四色样块应保留语义。配色发布无需数据库迁移，仍需核查手机端覆盖顺序及原有控件状态。

### 首页首屏

`components/sections/home-hero.tsx` 与 `app/home-hero.css` 控制首页标题、麦克风、按钮与四张视频卡片；`app/page.tsx` 的 `.home-stage` 同时包住首屏和生成器，使橙色背景随内容延长，不使用固定高度。独立字体在 `public/fonts/home-hero/`（附 OFL 许可），仅作用于首屏。参考视频完整版在 `public/videos/home-hero/`，静音循环在其 `reel/` 子目录，封面在 `public/posters/home-hero/`；替换时同步更新 `docs/media-sources.json`，不能将参考示例标注为本站生成。六语言首屏文案在 `lib/i18n/messages/home-hero.ts`。

`ShowcaseGrid` 已启用 `VideoCard.previewOnVisible`，共享示例卡片会在可见时静音循环、离屏暂停，点击打开有声弹窗；自动播放逻辑集中在 `components/video-card.tsx`，不要重复实现。
