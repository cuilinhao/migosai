# 替换与维护指南

此工程的营销页、计费和后端任务共用一些配置。修改品牌、套餐或供应商时，同时检查展示内容、服务端校验和外部控制台，避免页面文字与实际扣费不一致。

| 要替换的内容 | 主要位置 | 同步检查 |
| --- | --- | --- |
| 品牌名称与站点描述 | `app/layout.tsx`、`components/site-header.tsx`、`components/site-footer.tsx`、`content/home.ts`、页面文案 | `app/sitemap.ts`、`app/robots.ts`、法务页、OAuth 同意屏幕与支付商品名称 |
| Logo、颜色、字体 | `public/logo.png`、`app/globals.css`、`app/interactive.css`、`app/layout.tsx` | 1440/768/390 截图与移动菜单、对比度 |
| 展示视频与封面 | `public/videos/`、`public/posters/`、`RECON/asset-manifest.json` | 首页前四例为 9:16 裁切，案例页八例为 16:9 横屏；预览片单独使用 `/videos/preview.mp4` |
| 首页流程、特性、FAQ | `content/home.ts`、`components/sections/marketing-sections.tsx`、`app/page.tsx` | 不把静态 FAQ 改成与原站不符的默认折叠状态 |
| 积分包与价格 | `content/pricing.ts`、`components/pricing-cards.tsx` | `lib/server/payments.ts` 的服务端订单校验、Creem 四个商品、Worker 商品环境变量、购买回跳 |
| 视频选项及扣费 | `lib/video-options.ts`、`components/generator/duo-video-generator.tsx` | 测试中的六组时长/清晰度价格，服务端余额检查及商品说明 |
| 音乐模型与表单 | `lib/contracts.ts`、`components/generator/song-generator.tsx`、`lib/server/` 的音乐请求映射 | APIMart 实际支持的版本、10 积分扣费、成功输出格式与媒体白名单 |
| 域名与回调 | `wrangler.jsonc` 的 `APP_URL` 与 Worker 路由、`app/layout.tsx`、`app/sitemap.ts`、`app/robots.ts` | Google OAuth 回调、Creem 成功页/Webhook、R2 媒体 URL、Cloudflare DNS；当前使用根域及 `www` Worker 路由 |
| 法务与客服信息 | `app/privacy-policy/page.tsx`、`app/terms-of-service/page.tsx`、页脚 | 正式运营主体、有效联系方式、数据保留及退款政策须由运营方确认 |
| 支持邮箱 | 计划地址 `support@migosai.design`、域名 DNS 邮件记录 | 用户自行创建 Zoho 邮箱；完成后核验收发、转发及 MX/SPF/DKIM，再把地址写入网站联系方式 |

## 服务配置顺序

1. 按 [`.env.example`](.env.example) 准备本地变量；生产密钥只写入 Workers Secrets。不要在代码、文档、截图或 Git 提交里放真实值。
2. 对目标环境应用 D1 迁移并核验绑定到正确数据库；R2 必须为私有用户媒体准备独立桶。
3. Google 正式客户端、域名回调与真实登录已验证；更换域名或客户端后重新验证账户隔离与首次赠送积分。
4. Creem 四个商品、API Key、正式网站 Checkout 创建和三个 Webhook 事件已验证存在；商家资料已提交，正在审核且当前无需补操作。提交后的真实付款页仍提示账户验证，待审核放行后以真实签名事件验证一次性入账；页面回跳仅显示等待，不能代替 Webhook。
5. APIMart 的音乐和视频已分别在正式后端验证一次积分扣费、真实 cron、生产 R2 存储与授权读取，视频还验证了私有双图签名输入和素材审核。更换供应商/CDN 后重新核对 `APIMART_MEDIA_HOSTS`；仍需从浏览器 UI 复查提交、状态展示、结果播放和失败退款。
6. 完成 `npm run typecheck`、`npm test`、`npm run cf:build`，在 Worker 预览与正式域名复查页面、账户、付款和生成。更新 `CLONE_REPORT.md` 与 `CLONE_AUDIT.md` 中对应状态。

修改套餐价格或积分时，不要只改卡片文案。当前源站卡片的“约多少条视频”与生成器单次积分显示本就不一致，新的商品说明应以实际服务端报价为准并明确告知购买者。
