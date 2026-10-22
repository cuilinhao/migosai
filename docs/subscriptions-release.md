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

本次实际结果和发布版本在最终交付时记录；配置说明本身不代表生产已上线。
