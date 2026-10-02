# Migos AI

基于原站公开页面和浏览器截图重建的独立应用。目标域名为 `migosai.design`。前端使用 Next.js 15 / React 19，Cloudflare Workers 运行服务端，D1 保存账户、任务和积分账本，R2 保存用户媒体。视频接入 APIMart Seedance 2.5，音乐界面使用 Suno V6 系列，付款流程接入 Creem。

这是重新实现的工程，源站的登录、支付和生成 API 没有被复用。正式域名已部署，真实浏览器 Google 登录与新用户 10 积分已验证。**Creem 真实付款及从生产界面提交生成的完整链路仍未验证，不能据此视为全部业务上线。**

## 页面

| 路由 | 内容 |
| --- | --- |
| `/` | Hotel Lobby 双图视频生成器、案例、FAQ、定价 |
| `/pricing` | 四档一次性积分包 |
| `/showcases` | 八个本地视频案例 |
| `/ai-rap-song-generator` | Suno V6 音乐生成器 |
| `/privacy-policy`、`/terms-of-service` | 目标站法务草稿 |
| `/sign-in`、`/sign-up` | Google 登录入口 |
| `/app/video-generator` | 用户中心视频生成 |
| `/app/my-videos`、`/app/my-orders`、`/app/my-credits` | 视频、订单与积分记录 |

公开八页已按 1440、768、390 三档采集本地 QA 截图，24 条路由检查均无横向溢出或坏图；账户四页按已登录原站证据实现，另有 12 条三档路由检查无横向溢出。实际像素差异尚未量化，详见 [复刻报告](CLONE_REPORT.md)。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm ci
npm run dev
npm run typecheck
npm test
```

`npm run dev` 适合检查页面。需要验证 Cloudflare 绑定、D1 与 R2 时，按 [`.env.example`](.env.example) 准备本地忽略文件并运行 `npm run preview`；`npm run cf:build` 单独生成 OpenNext Worker 包。不要把真实凭据写入仓库。新数据库使用 `npm run db:local` 应用本地迁移；部署环境的远端迁移须先确认目标数据库及备份策略，再运行 `npm run db:remote`。

## 配置与当前状态

运行时需要 `DB`、`MEDIA` 等 Cloudflare 绑定，以及 Google、APIMart、Creem 的服务端配置。环境变量名和用途在 [`.env.example`](.env.example)；密钥通过本地忽略文件或 Workers Secrets 提供。没有配置的功能返回明确不可用状态，不模拟付款或生成成功。

Cloudflare Worker 已部署到 `migosai.design` 的根域和 `www` 路由，六项正式密钥已通过 Workers Secrets 配置，远端 D1 两份迁移已应用。真实浏览器 Google OAuth 成功，首次登录账户获得 10 积分，证据见 `QA/screenshots/live-google-login-success.jpg`。正式域名匿名 `/api/me` 返回 200 且认证已配置；无签名及错误签名的 Webhook 请求返回 401。此前本机代理的 TUN 假 IP 缓存曾导致部分主域 TLS 连接失败，并非 Worker 服务异常。

Creem 四个生产商品、API Key 与三个 Webhook 事件已创建。无客户资料、无付款的生产 Checkout 创建返回 HTTP 200/pending；商家资料随后已提交，后台显示正在审核且当前无需补操作。提交前付款页的账户验证提示截图见 `QA/screenshots/creem-verification-required.jpg`。正式收款仍待审核放行并实测。APIMart V6 Mini 既有任务的两首音乐与一次新建 Seedance 2.5 视频已通过生产媒体解析/转存函数写入真实本地 R2，并由授权 API 返回 200；这使用本地 D1 fixture，不代表生产网站界面、扣费与异步任务完整闭环已验证。输出 CDN 精确主机为 `getapib.org`。

## 证据与交付

- [原站侦察](RECON/findings.md)、[本地素材清单](RECON/asset-manifest.json)
- [复刻对照](CLONE_REPORT.md)、[交付审计](CLONE_AUDIT.md)、[替换指南](REPLACE_GUIDE.md)
- [项目记录](NOTES.md)、[实现方案](docs/implementation-plan.md)

`RECON/` 中的源站截图用于对照；`QA/` 包含本地公共页面截图与不含会话凭据的接口检查结果。源站账户私有截图不进入仓库。
