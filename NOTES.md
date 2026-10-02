# Migos AI 项目记录

## 来源与方法

- 源站：<https://migosai.com/>；本项目目标域名：`migosai.design`。
- 2026-10-02 在真实浏览器核查八个公开页面，保存 1440/768/390 截图、DOM 和交互状态；后续补看四个已登录账户页，私有账户证据不纳入仓库。
- 未取得或复用源站源码。用户指定的 `web-clone` 技能用于先取浏览器证据、按真实路由与组件状态重建，再做本地视觉核查。展示层复杂度评为 L3；包含认证、积分、支付与异步生成的业务层评为 L6。
- 本地八个案例视频由用户提供；网页副本、封面及独立预览片列于 [素材清单](RECON/asset-manifest.json)。原件不在本工程内修改。

## 工程现状

八个公开页与四个账户页已实现。Next.js 15 / React 19 应用通过 TypeScript 和完整 OpenNext Cloudflare 构建；全套测试 57 项通过，包含八项真实 workerd 的上游重定向安全回归。本地 Worker 绑定 D1/R2 的 16 项 HTTP 检查通过，远端 D1 的两份迁移已应用。公开八页的 24 条三档路由检查无溢出或坏图，账户四页的 12 条三档检查无溢出。

Worker 当前版本 `04613329-9173-41d4-b2ba-87350b9d4b5f` 已部署至正式根域与 `www` 路由，六项正式 Workers Secrets 已配置，远端 D1 两份迁移已应用；原有 MX/TXT 邮件记录保留。Google 真实浏览器 OAuth 成功，新用户获得 10 积分，截图见 `QA/screenshots/live-google-login-success.jpg`。正式域名匿名 `/api/me` 返回 200，无签名和错误签名 Webhook 请求返回 401。本机代理 TUN 假 IP 缓存曾影响部分主域 TLS 连接，宜在独立网络复测 DNS/TLS。

Creem 四档生产商品、API Key 与三个 Webhook 事件已创建。正式网站 `/api/checkout` 以独立 QA 账户返回 200 并创建有效生产 Checkout，但提交商家资料后的付款页仍显示账户验证要求，截图见 `QA/screenshots/creem-after-submission.jpg`。后台状态为 `under_review`、当前无需补件，并提示通常约 48 个工作小时完成审核；正式收款与 Webhook 入账仍待实测。

APIMart 在正式后端已完成两条隔离 QA 闭环：V6 Mini 音乐提交一次、扣 10 积分一次、真实 cron 完成、生产 R2 双音频授权 GET 200；Seedance 2.5 视频用两张真私有上传图、签名图和两次审核通过，扣 50 积分一次，真实 cron 完成后生产 R2 视频授权 GET 200。视频观察至完成历时 443 秒，输出 5.056 秒、480×854 且有音轨，上游返回 cost 0.48437。会话和测试媒体已清理，任务与账本审计保留；浏览器 UI 端到端未测试。证据见 `QA/production-generation.json` 与 `QA/production-video.json`。

实现基线已推送至 GitHub `main`，提交 `add228e`。用户将自行创建 Zoho 邮箱 `support@migosai.design`；邮箱创建、转发与收发尚未验证，网站联系方式待邮箱可用后补入。

## 当前边界

- 浏览器证据支持页面结构、响应式与公开交互；没有逐像素相似度评分，不能称 100% 复刻。
- 57 项自动测试和 16 项本地 Worker 检查与另行执行的真实 Google 登录、生产 Checkout 创建、音乐/视频后端闭环是不同证据；尚无 Creem 真实付款或浏览器 UI 生成闭环验证。
- 付款只由签名 Webhook 确认；账本、任务状态、媒体访问按服务端校验。上游状态不确定与支付退款/争议目前需要人工核对。
- 法务正文为目标站草稿；正式运营主体、客服地址、保留期限与退款条款需要运营方确认。

继续工作请从 [README](README.md)、[复刻报告](CLONE_REPORT.md)、[交付审计](CLONE_AUDIT.md) 和 [替换指南](REPLACE_GUIDE.md) 进入。`docs/implementation-plan.md` 与 `RECON/findings.md` 保留实施前的历史判断，当前状态以上述交付文件为准。
