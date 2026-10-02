# Migos AI 项目记录

## 来源与方法

- 源站：<https://migosai.com/>；本项目目标域名：`migosai.design`。
- 2026-10-02 在真实浏览器核查八个公开页面，保存 1440/768/390 截图、DOM 和交互状态；后续补看四个已登录账户页，私有账户证据不纳入仓库。
- 未取得或复用源站源码。用户指定的 `web-clone` 技能用于先取浏览器证据、按真实路由与组件状态重建，再做本地视觉核查。展示层复杂度评为 L3；包含认证、积分、支付与异步生成的业务层评为 L6。
- 本地八个案例视频由用户提供；网页副本、封面及独立预览片列于 [素材清单](RECON/asset-manifest.json)。原件不在本工程内修改。

## 工程现状

八个公开页与四个账户页已实现。Next.js 15 / React 19 应用的 NSFW 独立快照通过 TypeScript 和完整 OpenNext Cloudflare 构建；该快照 231 项测试通过，包含六项真实 workerd 的视频审核案例。此前本地 Worker 绑定 D1/R2 的 16 项 HTTP 检查通过，D1 三份迁移已在本地及远端应用。公开八页的 24 条三档路由检查无溢出或坏图，账户四页的 12 条三档检查无溢出。

Worker 的 NSFW 审核验收版本 `5e268873-de4b-44a6-b135-af6ea9978b31` 已部署至正式根域与 `www` 路由，七项正式 Workers Secrets 已配置，D1 三份迁移已在本地与远端应用；原有 MX/TXT 邮件记录保留。Google 真实浏览器 OAuth 成功，新用户获得 10 积分，截图见 `QA/screenshots/live-google-login-success.jpg`。正式域名匿名 `/api/me` 返回 200，无签名和错误签名 Webhook 请求返回 401。本机代理 TUN 假 IP 缓存曾影响部分主域 TLS 连接，宜在独立网络复测 DNS/TLS。

Creem 四档生产商品、API Key 与三个 Webhook 事件已创建。正式网站 `/api/checkout` 以独立 QA 账户返回 200 并创建有效生产 Checkout，但提交商家资料后的付款页仍显示账户验证要求，截图见 `QA/screenshots/creem-after-submission.jpg`。后台状态为 `under_review`、当前无需补件，并提示通常约 48 个工作小时完成审核；正式收款与 Webhook 入账仍待实测。

APIMart 在先前部署的正式后端已完成两条隔离 QA 闭环：V6 Mini 音乐提交一次、扣 10 积分一次、真实 cron 完成、生产 R2 双音频授权 GET 200；Seedance 2.5 视频用两张真私有上传图、签名图和两次审核通过，扣 50 积分一次，真实 cron 完成后生产 R2 视频授权 GET 200。视频观察至完成历时 443 秒，输出 5.056 秒、480×854 且有音轨，上游返回 cost 0.48437。会话和测试媒体已清理，任务与账本审计保留；浏览器 UI 端到端未测试。历史证据见 `QA/production-generation.json` 与 `QA/production-video.json`。

新视频安全审核已部署：生成视频先存私有且不可变的候选 R2 对象，SeeAPI `video-nsfw-filter/video-moderation` 对 32 帧采样（阈值偏移 0.02、特殊类别严格、无帧图片返回）。仅明确完成且干净的结果开放访问；被标记或策略拦截则幂等退款，候选文件清理由 cron 持久重试；技术故障最多重试八次或 30 分钟后转人工保留，不自动退款。固定原始请求体和幂等键用于不确定提交重试，签名候选 URL 一小时有效并绑定 ETag；猜测键和 Range 不绕过门禁。未审核的旧完成视频也拒绝访问。本地待审、人工、拦截 UI 均无播放/下载按钮，见 `QA/moderation-ui.json` 与 `QA/screenshots/nsfw-review-states.jpg`。[官方文档](https://www.seeapi.com/docs/video-nsfw-filter/video-moderation/)提示采样审查可能误判或漏判。

生产 SeeAPI 干净视频样本已通过：复用既有安全宠物视频，无新 APIMart 生成，真实 cron 133 秒完成 32 帧检查、零标记，观察到一个逻辑审核任务；待审时用户媒体 404、审核签名 URL 200，终态用户媒体 200、Range 206、匿名 404、旧签名 404。QA 误清理测试对象后用完全相同的已审核字节恢复，multipart ETag 与持久记录一致，才重做最终读取；审核 cron 与终态读取跨并发部署版本。会话为零、R2 测试对象最终删除，保留一任务两账本。实际 SeeAPI 物理 POST 次数/费用未核查；违规内容拦截仅以模拟数据测试，浏览器 UI 未端到端测试。见 `QA/production-moderation.json`。

实现基线已推送至 GitHub `main`，提交 `add228e`。用户将自行创建 Zoho 邮箱 `support@migosai.design`；邮箱创建、转发与收发尚未验证，网站联系方式待邮箱可用后补入。

## 当前边界

- 浏览器证据支持页面结构、响应式与公开交互；没有逐像素相似度评分，不能称 100% 复刻。
- NSFW 独立快照 231 项自动测试、此前的 16 项本地 Worker 检查与另行执行的真实 Google 登录、生产 Checkout 创建、旧版音乐/视频后端闭环及新版干净视频审核是不同证据；尚无 Creem 真实付款、浏览器 UI 生成闭环或真实违规拦截验证。
- 付款只由签名 Webhook 确认；账本、任务状态、媒体访问按服务端校验。上游状态不确定与支付退款/争议目前需要人工核对。
- 法务正文为目标站草稿；正式运营主体、客服地址、保留期限与退款条款需要运营方确认。

继续工作请从 [README](README.md)、[复刻报告](CLONE_REPORT.md)、[交付审计](CLONE_AUDIT.md) 和 [替换指南](REPLACE_GUIDE.md) 进入。`docs/implementation-plan.md` 与 `RECON/findings.md` 保留实施前的历史判断，当前状态以上述交付文件为准。
