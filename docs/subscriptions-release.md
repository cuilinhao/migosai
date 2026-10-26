# 一次性积分包和周期订阅

## 产品规则

定价页分为订阅和一次性积分包两个 Tab。订阅支持月付、年付；年付一次收取全年金额，按原始 UTC 账期锚点发放 12 份月度积分。月底锚点会在短月份取当月最后一天，下个月恢复原日。每月未用订阅积分到期失效，消费先使用最近到期的订阅积分，再使用永久积分。历史余额和一次性购买余额继续永久有效。取消续费后，已付期间权益保留。

套餐价格及月积分以 2026-10-22 核对的 [PicLumen 官方定价](https://www.piclumen.com/pricing/) 为依据，仅采用价格和月度积分数量，不包含其模型、无限生成或积分结转承诺。精确价格定义在 `content/pricing.ts`。

| 套餐 | 月付 USD | 年付总额 USD | 每月积分 |
| --- | ---: | ---: | ---: |
| Lite | 7.59 | 73.08 | 750 |
| Standard | 24.99 | 239.88 | 2,500 |
| Pro | 49.99 | 449.88 | 6,000 |
| Elite 15K | 119.99 | 1,079.88 | 15,000 |
| Elite 25K | 179.99 | 1,619.88 | 25,000 |
| Elite 40K | 259.99 | 2,339.88 | 40,000 |
| Elite 60K | 359.99 | 3,239.88 | 60,000 |

## Stripe 配置

保留四个原有一次性 USD Price。另建立十四个固定 recurring USD Price：每方案各一个 `month` 和 `year`，interval_count=1、usage_type=licensed。环境变量使用 `.env.example` 的 `STRIPE_PRICE_MONTHLY_*`、`STRIPE_PRICE_YEARLY_*`，全部属于同一账户和 test/live 模式。

运行时 Restricted Key 需要 Checkout Sessions Write、Prices Read、Payment Intents Read、Customers Write（含读）、Subscriptions Read、Invoices Read（覆盖 Invoice Payments）、Customer Portal Write（覆盖门户配置读取及会话创建；Stripe Dashboard 当前按此权限组授权）。创建商品、价格和 Portal 配置是一次性管理操作，不需要把这些写权限永久交给 Worker。

`STRIPE_PORTAL_CONFIGURATION` 指向同模式且 active 的 Portal 配置：启用期末取消，`proration_behavior=none`；禁止 subscription_update，避免未经本站校验的换档、数量和折扣。可开启付款方式维护与发票查看。

Webhook 使用 `/api/webhooks/stripe` snapshot 事件。保留原九项，增加 `invoice.paid`、`invoice.payment_failed`、`customer.subscription.created`、`customer.subscription.updated`、`customer.subscription.deleted`。SDK API 固定为 `2026-09-30.endive`；接收旧版本 snapshot 后使用资源 ID 重新查询，不信任回跳参数或未经验证的快照金额。

只在 Stripe 已付发票、唯一 InvoicePayment 和成功 PaymentIntent 的金额、USD、用户、Price、数量与模式均核实后发积分。Checkout 完成仅绑定订阅。重复通知使用 invoice 和周期唯一键防重；退款及拒付进入人工复核，不自动转出资金或覆盖余额。

## 本地调试

截图中的 `Stripe webhook verification is not configured` 表示服务端缺少 `STRIPE_WEBHOOK_SECRET`，与管理员是否在 Chrome 登录 Stripe 无关。本地 `.dev.vars` 要完整覆盖 Stripe 模式、测试 API Key、四个一次性价格、十四个周期价格及 Portal 配置，避免继承生产 `wrangler.jsonc` 的 live Price。使用 Stripe CLI `listen --forward-to http://localhost:3014/api/webhooks/stripe` 提供当前会话签名密钥，订阅上述十四类事件。不得把生产密钥或生产数据库接入隔离验收。

实际 Worker 预览需显式指定本地上游，例如 `wrangler dev --port 3014 --ip localhost --local-upstream localhost:3014 --upstream-protocol http`。否则 Wrangler 默认按生产 routes 重写 Origin，本站正确的同源校验会拒绝本地 POST。不得通过关闭同源校验绕过。

测试模式仅允许项目已有的 localhost/127.0.0.1 HTTP 源地址；live 模式始终要求公开 HTTPS。密钥保存为权限 0600 的忽略文件或 Workers Secrets，不能写 Git、客户端变量、日志或截图。

## 数据迁移与发布

执行 0009 前确认 0007 图片和 0008 素材库迁移已应用。记录 D1 恢复书签、用户/订单/账本行数与永久积分总数。0009 将旧 `users.credits` 原值保留为永久积分，新增订阅表及独立周期桶。生成扣款由数据库触发器在同一事务内分摊；失败退款按原分摊返回，过期桶退款仍不可消费。

使用锁定的 Next.js 16.4.2、OpenNext 1.20.13、Wrangler 4.151.3；运行测试、类型检查、Cloudflare 构建和真实 Worker 预览。上传前复核生产当前版本，保持所有既有 Secrets/资源绑定，正式价格与测试价格绝不可混用。订阅发布完成后不可直接回退到仅支持永久余额的旧程序；应使用向前修复或同步规划账本兼容回退。

## 验收范围

自动化覆盖月/年价格和数量、跨模式/所有权拒绝、重复通知、首发票乱序、失败发票、并发扣款、到期与原桶退款、12个月锚点、Portal安全配置、六语言定价/政策、登录门禁和安全跳转。真实沙盒另外验证网页调起、测试卡支付、Stripe回调和到账。生产验收只打开并取消 Checkout，除非获得明确授权，不进行真实扣费。

## 2026-10-22 发布验收

- 自动化：102 个测试文件、1,694 项测试通过；类型检查和 Cloudflare 构建通过。
- 真实沙盒：一次性 Starter $9.90、Lite 月付 $7.59、Lite 年付 $73.08 均完成测试支付并正确到账；年付建立 12 个月桶，仅当前月 750 积分可用。取消续费、发票乱序及重复通知防重均通过。
- 真实 Worker：六语言定价页及首页/门户路由返回 200，Checkout、账单门户及重复通知到账防重通过。
- 正式配置：保留四个原有积分包 Price，新增十四个订阅 Price 和专用账单门户配置；原 Webhook 保留并扩展至十四类事件。运行密钥撤去商品/Webhook 管理权限，价格降为只读。
- 正式 D1 已应用 0009；迁移前后均为 57 个用户、13,491 永久积分、46 笔订单、62 条积分账本，外键检查无异常。恢复书签保存于本地忽略的发布证据目录。
- 正式页面已验证一次性 Starter $9.90 和 Lite 月付 $7.59 均能调起 Stripe，均未付款；公开路由、六语言页面、390px 手机布局及 675 条站点地图通过检查。
- 修复正式验收发现的取消后换周期问题：用户选择不同方案时，先由 Stripe 安全关闭本人旧未付款 Checkout；严格核对 expired/unpaid/无订阅后才原子退休旧订单。关闭失败、支付完成竞争、双请求同时换档均不会创建重复订阅；同方案重试继续复用。新增 14 项回归通过。

## 2026-10-26 账户订阅管理修复

订单页会核对本人 Checkout 和 Subscription 的当前状态：已完成的 Checkout 可在回调尚未到达时恢复订阅绑定；过期且未付款的 Checkout 会安全关闭本地待付款记录。此过程只同步状态，不发放积分，积分仍须经过 `invoice.paid` 校验。

待付款记录显示继续付款、取消待付款及确认中刷新入口，避免向尚未绑定的记录提供无效管理按钮。`POST /api/subscription/cancel` 接收本地 `subscriptionId`，验证登录、同源、用户归属及当前记录；只有 Stripe 确认 expired/unpaid/无订阅后才关闭订单。付款完成、状态竞争、上游失败时不会擅自标记取消。

真实订阅使用 [Stripe subscription_cancel 确认流程](https://docs.stripe.com/customer-management/portal-deep-links)，继续要求现有 Portal 配置为期末取消且不按比例计费，无需扩大 Subscriptions 写权限。打开确认页不代表已取消；确认后返回对应语言的“我的订单”，页面重新核对状态，并保留已付期间积分。未启用取消或模式不一致的 Portal 配置仍会拒绝使用。

本地浏览器验收使用真实 React 组件及模拟网络，覆盖未付款取消确认、已付款取消跳转、返回后取消状态和权益日期、确认中刷新及繁体中文界面。该验收不触发真实扣费或取消真实用户订阅。

首次本地验证：121 个测试文件、2,287 项测试通过；类型检查及 Cloudflare/OpenNext 构建通过。后续定价修复及发布验收见下方。

### 定价页当前套餐与测试取消验收

定价页读取当前登录用户的订阅状态，并在付款确认刷新账户、切回页面后重新核对。当前方案和付款周期显示灰色 `Current plan`；已有未结束订阅时引导至订阅管理，避免重复开启新订阅。取消续费但仍处于已付期间的订阅仍算当前方案；真正关闭后可重新购买。一次性积分包继续可购买。

使用隔离的本地 Worker、独立测试数据库和 Stripe test 账户完成真实取消确认：年付测试订阅停止续费后自动返回订单页，显示权益保留至 2027-10-22；Stripe 和本地取消标记一致，12 个月积分桶及 9,000 剩余总积分均未变化。生产 $14.90 月付订阅仅验证管理入口，未执行取消。

新增定价修复后：122 个测试文件、2,325 项测试通过，类型检查通过。

### 最终上线结果

- 代码提交：`9d767d0` 修复订阅管理和取消入口，`e6267ca` 修复当前套餐置灰及付款后状态同步，均已推送至 `main`。
- Cloudflare/OpenNext 生产构建通过，最终 Worker 版本为 `4b1ca0fd-ce66-4812-8c0c-b0eb49a0ec31`，部署至 `migosai.design` 和既有 www/Workers 路由，保留定时任务。
- 使用 Chrome 已登录的正式账号验收：$14.90 月付 Lite 显示禁用的 `Current plan`；刷新后仍正确；年付不误标为当前方案；积分包购买入口可用。订单页显示 Active 和 2026-11-26 下次续费日期，管理入口已成功打开 Stripe 门户。正式订阅 `cancel_at_period_end=false`。
- 真实 React 浏览器测试仅模拟网络：支付轮询确认后，账户与订阅自动刷新，Lite 无需重载即置灰；切换至无订阅账号和切回原账号均无旧状态残留。
- 最终只读线上检查：六语言首页 SEO、H1、Hotel Lobby 入口、生成器和关键内链与发布前一致；156 个页面、687 条站点地图 URL、5 项匿名 API 检查全部通过。40 个绑定、10 个 Secret 名称、非 Secret 变量值及运行配置全部保留。
- 本地忽略目录 `.local-evidence/subscription-management-20261026/` 保存构建、部署、HTTP、浏览器及沙盒取消证据；不将密钥、会话链接或用户凭据提交到仓库。临时测试 Worker 和付款回跳测试服务在验收后关闭。

## 2026-10-26 套餐升级修复

此前的定价保护把所有已订阅用户的方案按钮禁用，阻止了升级。现在仅当前方案和付款周期显示灰色 `Current plan`；其他可用方案显示 `Upgrade` 或 `Change plan`，调用新的 `/api/subscription/change`。登录、账号、报价、同源和原订阅 ID 均在服务端核对，仍禁止另开一份重复订阅。

升级使用独立 `STRIPE_SUBSCRIPTION_CHANGE_CONFIGURATION` 的 Stripe `subscription_update_confirm` 确认页，替换同一订阅项目的 Price、数量固定为 1，确认前不扣款。同账期升档立即按剩余时间补差，保留续费日期；降价或缩短周期由 Stripe 排期到本期结束。月付改年付会在确认后建立新账期，旧期未用时间由 Stripe 抵扣。确认页展示实际金额和日期。原管理/取消 Portal 配置保持独立，不扩大运行密钥权限。

保留原购买 metadata 和订单快照，另存此订阅已授权的目标价格。只在核对 Stripe 发票、付款和原订阅归属后调整积分：同账期补剩余时间对应的额度差，年付包含尚未开始的月份；重置账期时退休旧桶，迟到的生成退款不能使旧额度重新可用。新账单、旧通知重放、并发通知和同秒切换均有回归测试。

低于 Stripe 最低扣款额的差价可能结转至下期；仅在对应 `invoice_too_small` / `applied_to_invoice` 余额流水和实际支付核实后接受。测试时真实重现差价 12 美分结转、下期 $29.90 加 12 美分共支付 $30.02。试用、欠款、已有排期或旧 `renewalCredits` 管理策略暂须先从管理入口处理。

部署前应用 `0011_subscription_changes.sql`，记录 D1 恢复书签及迁移前后行数/余额。迁移保留历史 ID、账本及生成分摊，补原价格，并兼容发布期间旧 Worker 不带 `price_id` 的发票写入。升级后不能把仍在使用旧授权价格校验的程序作为长期回退版本。

真实沙盒浏览器已完成 Lite $14.90 → Standard $29.90 升级，确认补差价 $14.99；原 Stripe 订阅 ID 保持不变，仅一份活动订阅。回调返回 200，当前桶从 550 补到按剩余时间计算的 1,149 积分，永久余额保持 0；价格页自动将 Standard 置灰，Pro/Elite 仍可升级。生产账号的 $14.90 月付订阅未执行升级或取消。

升级返回页会等待最新 Stripe 发票落账，再自动刷新账户余额；30 秒未确认时提供重试及管理入口，不宣称付款成功。最终 125 个测试文件、2,420 项测试、类型检查及 Cloudflare/OpenNext 构建通过。生产 0011 迁移完成，用户/订单/订阅/发票/积分桶/账本行数、永久及订阅余额均与迁移前一致，外键检查无异常。

发布提交 `9daebba`，Worker 版本 `6f04d89b-aee0-42a3-8a36-958b8ba11c2e`。正式账号页面及刷新后均验证仅 Lite 当前月付禁用，Standard/Pro/Elite 升级可用；Standard 确认页显示本次补差 $14.96 和下期 $29.90，未提交正式确认。原管理/取消配置及原 40 个绑定、10 个 Secret 保留，仅新增升级 Portal 变量。六语言首页与发布前一致；156 个页面、687 条站点地图 URL、7 项匿名 API 检查零失败。沙盒验收后已关闭测试订阅续费和临时服务；本轮证据保存于 `.local-evidence/subscription-upgrade-20261026/`。
