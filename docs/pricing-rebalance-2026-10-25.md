# 2026-10-25 定价切换部署说明

本次定价代码、正式 Stripe 商品/Price 及 Worker 配置已于 2026-10-25 完成生产发布和验收；实际部署版本及验收结果见文末。本次无需数据库迁移；生成扣积分规则保持原样。

## 上线前必须配置的 8 个新 recurring Price

为每个环境分别创建下面 8 个 USD recurring Price，并将对应环境变量指向新 Price ID。每项均为 `interval_count=1`、`usage_type=licensed`，按完整固定金额收费，无试用、折扣、按比例收费或额外税费。年付一次扣款，额度按月发放和到期；全年价格为月价乘 12 再打九折。

| 环境变量 | interval | unit_amount（美分） | 每月积分 |
| --- | --- | ---: | ---: |
| `STRIPE_PRICE_MONTHLY_LITE` | month | 1490 | 550 |
| `STRIPE_PRICE_YEARLY_LITE` | year | 16092 | 550 |
| `STRIPE_PRICE_MONTHLY_STANDARD` | month | 2990 | 1150 |
| `STRIPE_PRICE_YEARLY_STANDARD` | year | 32292 | 1150 |
| `STRIPE_PRICE_MONTHLY_PRO` | month | 4990 | 1950 |
| `STRIPE_PRICE_YEARLY_PRO` | year | 53892 | 1950 |
| `STRIPE_PRICE_MONTHLY_ELITE_4000` | month | 9990 | 4000 |
| `STRIPE_PRICE_YEARLY_ELITE_4000` | year | 107892 | 4000 |

`wrangler.jsonc` 已替换 Lite、Standard、Pro 的 6 个正式 Price ID，增加 Elite 4000 的 2 个 ID，并移除 8 个退役 Elite 配置键。所有新 Price 均创建于 MigosAI 沿用的 LobbyDuo 正式商户 `acct_1UMOG79IlL4CIeBl`。测试与正式环境必须使用各自账户和模式的 Price ID，不能混用。

旧 `ELITE_15000`、`ELITE_25000`、`ELITE_40000`、`ELITE_60000` 环境变量已从模板及类型声明移除。旧订阅续费不依赖这些配置键，而是读取已保存的 `subscriptions.price_id`、`amount_cents` 和 `monthly_credits`。不要为此次调价更改任何现有 Stripe Subscription 的 Price、金额、额度或 metadata。已归档的旧 Price 仍可用于核验历史订阅履约。

## 积分包和历史权益

积分包价格没有变化，现有符合金额、币种和模式要求的 `one_time` Price 可以继续使用：

| 积分包 | 美元 | 新购永久积分 | 配置键 |
| --- | ---: | ---: | --- |
| Starter | 9.90 | 300 | `STRIPE_PRICE_STARTER` |
| Creator | 29.90 | 950 | `STRIPE_PRICE_CREATOR` |
| Pro | 49.90 | 1600 | `STRIPE_PRICE_PRO` |
| Business | 99.90 | 3300 | `STRIPE_PRICE_BUSINESS` |

正式 Stripe 四个积分包已统一采用数量名称 `MigosAI — N credit pack`，描述分别为 300、950、1600、3300 永久积分，明确永不过期、独立于订阅积分、一次性购买且不自动续费。四个 one_time Price ID 和金额均保持不变；Starter 仍为 $9.90 / 300。商品展示文案的调整没有改写历史订单积分快照。

新积分包按新目录写入订单快照。已创建订单继续按 `orders.amount` 和 `orders.credits` 履约，包含旧 Creator 1200、Pro 2200、Business 5000 积分和已报价的 2026 黑五 20% 加赠订单。不要通过迁移脚本重新计算订单、订阅或用户余额。新活动最多加赠 10%，不能叠加；已公开的 2026 黑五活动保留 20%。

旧 Lite 750 积分以及已下架的多档 Elite 订阅仍按各自数据库快照续费和发积分。年付旧订阅继续按旧月额度创建 12 个独立月份积分桶。现有订阅的取消入口继续有效，Portal 配置仍只允许期末取消，禁止改套餐和按比例收费。

后续单订阅例外：用户于 2026-10-25 明确指定一位旧 Lite 用户，自下一账期起每次 $7.59 月付续费改发 400，原购买与历史快照保留，详见 [旧订阅续费额度调整记录](./legacy-renewal-credits-2026-10-25.md)。此例外不改变其他订阅或本次新购目录。

## 结账切换边界

订阅结账请求必须提交 `expectedCredits` 和 `expectedAmountCents`，并与当前套餐和计费周期一致。缺失字段或旧页面报价会返回 409，提示刷新价格页面后再结账。

对同套餐的旧待支付 Checkout，服务端比较已保存的 Price ID、金额和月额度。若旧 Checkout 仍为未支付的 open 状态，先向 Stripe 请求关闭并验证成功，再创建新报价订单。若已经完成支付或状态无法确认，保持原记录并等待支付确认，不调整其权益。

若一次旧请求已经保存订单但遗失了 Stripe Checkout 响应、因而没有 `checkout_id`，报价变化后会阻止再次创建 Checkout，返回“Another subscription checkout is pending.”，由支持人员核对原幂等请求和支付状态。不能猜测该会话不存在，也不能以新参数覆盖旧幂等请求。

## 发布和验收

1. 先按仓库 `AGENTS.md` 拉取主分支并确认包含最新主分支修复，再完成全套测试、类型检查和构建。
2. 在 Stripe 测试模式配置 8 个新 recurring Price，核对全部月付和年付组合的扣款金额、订单快照及积分发放；验证旧 Price 配置会被拒绝。
3. 将获批准的正式 Price 配置与代码一同发布，保留原 webhook、签名密钥和旧订阅记录。不要先发布仍引用旧 Price 的配置。
4. 验收四档订阅、四档积分包、六语言定价、黑五页面及首页原有内容、生成功能；检查旧页面刷新提示和历史账户取消入口。
5. 确认已有旧订阅仍按旧价续费、旧年付仍逐月发放、延迟历史订单仍按原积分到账，且 webhook 重试不重复发放。

本地回归覆盖真实 Stripe SDK 边界与 SQLite/D1 履约，包括新购 8 个订阅组合、4 个积分包、旧 Lite 和退役 Elite 续费、旧报价拒绝、历史加赠订单、重复签名 webhook 和实际 workerd 账本触发器。测试不使用线上 Stripe、密钥或远程数据库。

## 本次正式 Stripe 配置记录

新建独立订阅商品，保留原商品及所有已有 Subscription，不覆盖旧额度描述。

| 套餐 | Product ID | 月付 Price ID | 年付 Price ID |
| --- | --- | --- | --- |
| Lite 550 | `prod_VVMylnelCYHjB8` | `price_1UUME89IlL4CIeBlcLEnAMUO` | `price_1UUMEk9IlL4CIeBlcC9ytGnL` |
| Standard 1150 | `prod_VVMz0SDWRevmZA` | `price_1UUMFH9IlL4CIeBlp6AsxAig` | `price_1UUMFZ9IlL4CIeBl28ZOcVY8` |
| Pro 1950 | `prod_VVMzXN0HxDIL9S` | `price_1UUMFw9IlL4CIeBl1BT9tQcV` | `price_1UUMGC9IlL4CIeBlvt5FzBss` |
| Elite 4000 | `prod_VVN0xkadwh2vZA` | `price_1UUMGS9IlL4CIeBlyx6yBGmw` | `price_1UUMGh9IlL4CIeBlq66gjoiF` |

发布前验证：112 个测试文件、1991 项测试通过；TypeScript 与 OpenNext Cloudflare 构建通过。首次并行测试出现既有 scrypt 限流测试超时，单文件和完整串行复跑均通过，未修改认证源码。

回退基线：Worker `cbae4c6b-55a4-4a5c-be2f-65d2624df8fc`，100% 流量；保留原 10 个 Secrets、D1/R2、路由、cron 与 Portal 配置。

## 生产发布与验收结果

- 代码提交：`adf77d3`，已快进合并并推送 `main`，发布前确认包含最新 `origin/main`。
- 正式地址：`https://migosai.design/pricing`。Worker 版本：`ad52938d-ad18-420f-9eb8-cb818cccc0ec`，100% 流量，2026-10-25 07:59:45 UTC 发布。
- 重新核对 10 个 Secrets 名称完全保留；APP_URL、支付 live 模式、Portal、D1/R2、两个域名路由及每分钟 cron 保持原配置。未执行迁移、修改已有订阅或调整余额。
- 浏览器逐一打开 8 个新订阅 Checkout：月付 $14.90/$29.90/$49.90/$99.90；年付 $160.92/$322.92/$538.92/$1,078.92。每个商品描述均为相应每月 550/1,150/1,950/4,000 积分、按月到期，年付全年扣款但按月发放。
- 浏览器逐一打开 4 个积分包 Checkout：$9.90/300、$29.90/950、$49.90/1,600、$99.90/3,300；标题、永久积分描述、金额全部匹配。Starter 原 Price ID 未变。
- 所有 Checkout 均返回网站，未提交支付信息或完成扣款。只读核对本轮 12 个订单：金额、USD、stripe/live、积分快照及 Checkout 记录全部正确；8 个订阅报价无实际 Stripe Subscription、无已付发票；付款账本 0 条、发放积分 0。切换套餐自动关闭前 7 个未付订阅 Checkout，余下 1 个订阅与 4 个积分包仍为未付款 pending。验收前后页面余额均为 9381。
- 全站 i18n 检查：156 页面、687/687 sitemap URL，0 失败。专项检查：六语言首页、定价、黑五和 Window Peeper 共 24 页面通过。首页原 SEO、H1、canonical、生成器锚点及内链全部保留。
- 黑五仍为 upcoming，原 2026 活动保留 20% 加赠，展示 360/1,140/1,920/3,960 积分。新目录年付页面显示统一九折。
- 本次真实验收覆盖正式收银台打开与取消，没有使用真实资金，也没有新做沙盒付款/续费；履约、旧订阅和重复回调继续由本轮通过的自动化回归覆盖。
- 部署工具首次自动转发时无法处理含空格的 message，尚未上传即失败；改用已构建产物的 `wrangler deploy --autoconfig=false` 后正常发布，未改变代码或依赖。

## Stripe 原有账户提醒

切换账户时 Stripe 显示收款能力活跃，但 Payouts 已暂停，提示更新银行账户信息。此状态在本次调价前已存在；本次未更改银行账户或提现设置。
