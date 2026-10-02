# Migos AI 项目记录

## 来源与方法

- 源站：<https://migosai.com/>；本项目目标域名：`migosai.design`。
- 2026-10-02 在真实浏览器核查八个公开页面，保存 1440/768/390 截图、DOM 和交互状态；后续补看四个已登录账户页，私有账户证据不纳入仓库。
- 未取得或复用源站源码。用户指定的 `web-clone` 技能用于先取浏览器证据、按真实路由与组件状态重建，再做本地视觉核查。展示层复杂度评为 L3；包含认证、积分、支付与异步生成的业务层评为 L6。
- 本地八个案例视频由用户提供；网页副本、封面及独立预览片列于 [素材清单](RECON/asset-manifest.json)。原件不在本工程内修改。

## 工程现状

八个公开页与四个账户页已实现。Next.js 15 / React 19 应用通过 TypeScript、Next 和 OpenNext Cloudflare 构建；全套测试 49 项通过。本地 Worker 绑定 D1/R2 的 16 项 HTTP 检查通过，远端 D1 的两份迁移已应用。公开八页的 24 条三档路由检查无溢出或坏图，账户四页的 12 条三档检查无溢出。

Worker 已部署至正式根域与 `www` 路由，六项正式 Workers Secrets 已配置，远端 D1 两份迁移已应用；原有 MX/TXT 邮件记录保留。Google 真实浏览器 OAuth 成功，新用户获得 10 积分，截图见 `QA/screenshots/live-google-login-success.jpg`。正式域名匿名 `/api/me` 返回 200，无签名和错误签名 Webhook 请求返回 401。本机代理 TUN 假 IP 缓存曾影响部分主域 TLS 连接，宜在独立网络复测 DNS/TLS。

Creem 四档生产商品、API Key 与三个 Webhook 事件已创建。无客户资料的生产 Checkout 创建返回 HTTP 200/pending；商家资料已提交，后台显示审核中且当前无需补操作，正式收款与 Webhook 入账仍待实测。APIMart 两首已完成 V6 Mini 音乐及一次新建 Seedance 2.5 视频经生产媒体函数写入真实本地 R2，授权 API 返回 200，精确 CDN 主机为 `getapib.org`。任务记录使用本地 D1 fixture，不代表生产 UI 完整生成与积分扣费已验证。

## 当前边界

- 浏览器证据支持页面结构、响应式与公开交互；没有逐像素相似度评分，不能称 100% 复刻。
- 49 项自动测试和 16 项本地 Worker 检查与另行执行的真实 Google 登录、APIMart 媒体联调是不同证据；尚无 Creem 真实付款或生产 UI 生成闭环验证。
- 付款只由签名 Webhook 确认；账本、任务状态、媒体访问按服务端校验。上游状态不确定与支付退款/争议目前需要人工核对。
- 法务正文为目标站草稿；正式运营主体、客服地址、保留期限与退款条款需要运营方确认。

继续工作请从 [README](README.md)、[复刻报告](CLONE_REPORT.md)、[交付审计](CLONE_AUDIT.md) 和 [替换指南](REPLACE_GUIDE.md) 进入。`docs/implementation-plan.md` 与 `RECON/findings.md` 保留实施前的历史判断，当前状态以上述交付文件为准。
