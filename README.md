# Migos AI

基于原站公开页面和浏览器截图重建的独立应用。目标域名为 `migosai.design`。前端使用 Next.js 15 / React 19，Cloudflare Workers 运行服务端，D1 保存账户、任务和积分账本，R2 保存用户媒体。视频接入 APIMart Seedance 2.5，音乐界面使用 Suno V6 系列，付款流程接入 Creem。

这是重新实现的工程，源站的登录、支付和生成 API 没有被复用。正式域名已部署，真实浏览器 Google 登录与新用户 10 积分已验证；生产后端的音乐和视频生成链路也已分别跑通。新的视频安全审核已通过本地验收和一次生产干净视频样本验证。**Creem 真实付款尚未启用，浏览器 UI 提交生成的端到端流程仍未验证，不能据此视为全部业务上线。**

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

运行时需要 `DB`、`MEDIA` 等 Cloudflare 绑定，以及 Google、APIMart、SeeAPI、Creem 的服务端配置。环境变量名和用途在 [`.env.example`](.env.example)；密钥通过本地忽略文件或 Workers Secrets 提供。没有配置的功能返回明确不可用状态，不模拟付款或生成成功。

Cloudflare Worker 已部署到 `migosai.design` 的根域和 `www` 路由，本次 NSFW 审核验收部署版本为 `5e268873-de4b-44a6-b135-af6ea9978b31`（不代表站点最新版本）。七项正式密钥已通过 Workers Secrets 配置，D1 三份迁移已在本地及远端应用；NSFW 独立快照的类型检查、完整 OpenNext 构建及 231 项自动测试已通过。真实浏览器 Google OAuth 成功，首次登录账户获得 10 积分，证据见 `QA/screenshots/live-google-login-success.jpg`。正式域名匿名 `/api/me` 返回 200 且认证已配置；无签名及错误签名的 Webhook 请求返回 401。此前本机代理的 TUN 假 IP 缓存曾导致部分主域 TLS 连接失败，并非 Worker 服务异常。

Creem 四个生产商品、API Key 与三个 Webhook 事件已创建。正式网站 `/api/checkout` 使用独立 QA 账户返回 200 并创建有效生产 Checkout；打开付款页仍显示账户验证要求，截图见 `QA/screenshots/creem-after-submission.jpg`。商家资料已提交，Creem 状态为 `under_review`，当前无需补件；正式收款仍待放行并实测。

先前部署的生产后端在隔离 QA 账户上完成了 V6 Mini 音乐的提交、一次 10 积分扣费、真实 cron、生产 R2 双音频与授权读取；Seedance 2.5 视频也完成私有双图上传、签名图审核、一次 50 积分扣费、真实 cron、生产 R2 视频与授权读取。历史证据见 [`QA/production-generation.json`](QA/production-generation.json) 和 [`QA/production-video.json`](QA/production-video.json)。两次测试都未从浏览器 UI 点击生成，测试媒体已清理。输出 CDN 精确主机为 `getapib.org`。

新版视频结果先存为私有候选文件，再交由 SeeAPI 对 32 帧采样审核；仅明确完成且通过的结果开放播放和下载。被标记的视频退款，审核技术故障则保留人工处理且暂不开放媒体；原有未经审核的完成视频也按拒绝访问处理。本地待审、人工和拦截状态无下载入口，见 [`QA/moderation-ui.json`](QA/moderation-ui.json)。生产 QA 复用既有安全视频、未新建 APIMart 任务：真实 cron 在 133 秒后完成 32 帧零标记审查，完成前用户读取 404，完成后授权读取 200、Range 206、匿名读取 404，证据见 [`QA/production-moderation.json`](QA/production-moderation.json)。此次补验因 QA 清理顺序错误恢复了同一份已审核字节并核对 ETag；拦截路径仅在模拟测试验证，浏览器 UI 未端到端测试。[SeeAPI 模型文档](https://www.seeapi.com/docs/video-nsfw-filter/video-moderation/)说明采样审查可能误判或漏判，不构成全片安全保证。

实现基线已推送至 GitHub `main`，提交 `add228e`。用户将自行创建 Zoho 邮箱 `support@migosai.design`；目前创建、转发与收发均未验证，网站联系方式需待邮箱可用后补入。

## 证据与交付

- [原站侦察](RECON/findings.md)、[本地素材清单](RECON/asset-manifest.json)
- [复刻对照](CLONE_REPORT.md)、[交付审计](CLONE_AUDIT.md)、[替换指南](REPLACE_GUIDE.md)
- [项目记录](NOTES.md)、[实现方案](docs/implementation-plan.md)

`RECON/` 中的源站截图用于对照；`QA/` 包含本地公共页面截图与不含会话凭据的接口检查结果。源站账户私有截图不进入仓库。
