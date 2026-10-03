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

生产 `APP_URL` 必须使用可公开访问的 HTTPS 源地址，供服务商读取参考素材。媒体 CDN 仅加入服务商实际返回且核实过的精确主机名。Waffo 沙箱和生产使用各自的密钥，`WAFFO_MODE` 必须与目标环境一致。

## 数据库与发布

1. 安装锁定依赖并运行 `npm test`、`npm run typecheck`、`npm run cf:build`。
2. 检查 `wrangler.jsonc` 的账户、D1、R2、路由和环境是否属于本次目标；生产配置含站点专用资源 ID，复制工程时需替换。
3. 新环境执行本地迁移 `npm run db:local`。生产发布前检查远端待执行迁移及备份，再用 `npm run db:remote` 应用缺少的迁移。声音与动作功能依赖 `0005_reference_uploads.sql`。
4. 在确认的源码版本运行 `npm run deploy`，记录提交和发布版本。以 [QA 说明](QA/README.md) 核查线上页面、认证、媒体访问及关键交互。

保留已有任务、积分账本及历史付款记录。不要把忽略目录中的凭据、数据库转储、原始日志或真实账户截图放入发布源码。

## Waffo 正式收款验收

目前商户配置、四档商品和 Webhook 已配置；沙箱付款、签名通知及幂等入账已验证。正式创建付款仍因商户审批返回 403，尚无生产交易验收。

商户审批通过后，复核 `WAFFO_MODE=prod`、价格、积分和商品状态，再从正式站点创建新的 Checkout。完成交易后核查签名回调、金额与商品绑定、积分只入账一次，以及重复通知和退款人工核对路径。付款回跳参数和接口拒绝未签名请求都不能代替真实交易验证。

回调入口为 `/api/webhooks/waffo`，处理 `order.completed`、`refund.succeeded`、`refund.failed`。旧 Creem 路由已移除，历史订单保留；旧服务商后台 Webhook 是否已删除需另行核查。

## 内容与素材替换

- 公开文案使用 `content/` 和 `lib/i18n/messages/`；同步六种语言、FAQ 结构化数据、canonical、hreflang、sitemap 与 `public/llms.txt`。
- 模板动作与音轨按 [`public/templates/hotel-lobby/README.txt`](public/templates/hotel-lobby/README.txt) 的时长和格式约束替换。
- 视频费用改动需同步服务端报价、控件展示和相关测试。套餐改动需同时核对站内配置与 Waffo 商品。
- 法务正文中的运营主体、联系方式、保留期限和退款说明仍需运营方确认后更新。

Chrome 下载到本地文件尚未验收通过。修改播放或下载逻辑时，应分别验证浏览器播放、授权读取和最终文件保存，不能用其中一项代替另外两项。
