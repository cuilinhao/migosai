# 交付审计

审计日期：2026-10-02。范围为当前仓库、`RECON/` 与 `QA/` 的可交付文件；账户私有浏览器证据由 `.gitignore` 排除。本报告不包含密钥、Cookie 或个人账户资料。

## 已核查

| 项目 | 结果与证据 |
| --- | --- |
| 路由 | 八个公开路由及四个 `/app/*` 路由均有实现；`QA/routes.json` 的 24 条与 `QA/account-routes.json` 的 12 条均无横向溢出，公开页无坏图。 |
| 追踪脚本 | 应用源码未发现 Google Analytics、热图或广告像素注入。Google 登录、Creem 与 APIMart 属于明确的业务服务。 |
| 源站残留 | 对 `app/`、`components/`、`content/`、`lib/` 和脚本搜索，未发现 `migosai.com`、旧品牌 Sulphur、源站客服邮箱或 2025 法务日期。`RECON/` 保留原站 URL 是证据用途。 |
| 凭据 | `.env*`、`.dev.vars*` 等本地凭据文件已忽略；`.env.example` 仅列空值/说明。Worker 配置中的公开绑定名与商品标识不等于 API Key。私有账户截图位于被忽略目录。 |
| 素材 | 八个案例有本地网页视频及封面，另有首页预览片；原始用户视频保留在工程外。`RECON/asset-manifest.json` 记录原件校验和到网页文件的映射。 |
| 业务失败态 | 未配置支付、生成等服务时返回错误；前端不把跳转或查询参数当作支付成功。付费额度由服务端复核并用账本记录。 |
| 正式部署与登录 | 根域和 `www` 已部署 Worker；六项正式 Workers Secrets 和两份远端 D1 迁移已就位。真实浏览器 Google OAuth 成功，新用户获 10 积分；截图见 `QA/screenshots/live-google-login-success.jpg`。 |
| 真实媒体样本 | 两首 APIMart 音乐及一次新建 Seedance 视频经生产解析/转存函数写入真实本地 R2，授权 API 返回 200；精确 CDN 主机 `getapib.org`。D1 任务采用本地 fixture，未验证生产 UI 全链路。 |
| 生产生成闭环 | 隔离 QA 账户的音乐一次扣 10 积分并由真实 cron 完成，生产 R2 双音频授权读取 200；私有双图视频一次扣 50 积分，审核与真实 cron 完成后生产 R2 视频授权读取 200。详见 `QA/production-generation.json`、`QA/production-video.json`；均未从浏览器 UI 点击生成。 |

## 上线前仍需完成

1. **域名：** 正式 Worker 路由已部署，Google 真实登录成功；匿名 `/api/me` 返回 200 且认证已配置，无签名及错误签名 Webhook 返回 401。此前本机代理 TUN 假 IP 缓存曾导致部分主域 TLS 失败，宜在独立网络复查 DNS/TLS。原有 MX/TXT 邮件记录已保留。
2. **Creem：** 四档生产商品、API Key 和 `checkout.completed`、`refund.created`、`dispute.created` 三个 Webhook 事件已创建。正式网站 `/api/checkout` 使用独立 QA 账户返回 200 并创建有效生产 Checkout；提交商家资料后付款页仍提示账户验证，截图见 `QA/screenshots/creem-after-submission.jpg`。后台显示审核中、当前无需补操作。待审核放行后，仍需以真实付款验证签名回调、订单金额/商品绑定、重复事件幂等入账及退款/争议处理。
3. **APIMart：** 除本地 fixture 外，正式部署的后端音乐与视频均已验证一次扣费、真实 cron、生产 R2 及授权 GET 200。视频私有双图上传与签名素材审核也已跑通。仍需从浏览器 UI 验证点击生成、状态展示和失败退款；新增媒体主机必须逐个核验，不使用猜测域名或通配符。
4. **邮箱与运营：** 用户将自行创建 Zoho 邮箱 `support@migosai.design`；创建、转发与收发尚未验证，网站联系方式待可用后补入。另需为 `manual_review` 任务及支付退款/争议建立人工检查流程，确定媒体保留期限、用户删除请求渠道和法务运营主体信息。
5. **视觉和无障碍：** 在正式域名做一轮 1440/768/390 复测与关键交互检查。现有本地三档路由检查无溢出，截图是结构和视觉证据，不是逐像素合格证。
6. **资产权利：** 用户提供的视频、参考站视觉/文案及任何音频的公开使用权限需由实际权利人确认。此仓库不含原站源码许可证明。

## 测试证据的适用范围

`npm test` 57 项、类型检查、完整 OpenNext 构建及 16 项本地 Worker+D1/R2 HTTP 检查已通过；远端 D1 两个迁移已应用。新增八项真实 workerd 回归，覆盖手动处理并拒绝上游 3xx；Cloudflare 运行时不支持此前使用的 `redirect: error`，现已修正。自动测试大量使用本地 SQLite 与受控供应商响应，不证明真实跨区域并发或 Creem 付款。真实 Google 登录、生产 Checkout 创建、音乐与视频后端完整生成链路另有生产证据；生成测试由隔离 QA 账户通过 API 发起，未覆盖浏览器 UI 端到端。生产测试的会话已撤销、媒体已清理，账本与任务审计保留。
