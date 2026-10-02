# Migos AI 全站实现计划

**目标：** 按 RECON 中真实浏览器证据重建八个公开页面和交互，接入独立APIMart/Creem后端，并生成可在Cloudflare Workers运行的工程。

**规格：** `docs/replica-scope.md`、`RECON/findings.md`。用户最新要求覆盖旧方案：1:1所有页面、本地视频、Creem及源站套餐、Chrome linhao操作。

**技术栈：** Next.js 15.5.27、React 19、TypeScript、Tailwind v4、Radix Dialog/Select、Lucide、OpenNext Cloudflare、D1、R2、原生fetch/Web Crypto。

## 工作分工和接口

- 主控：工程配置、依赖、素材优化、Cloudflare配置与账号检查、集成、浏览器验证、审计和交付。
- 页面实现：`app/layout.tsx`、`app/globals.css`、首页/定价/法务页、`components/site-*`、`components/sections/*`、`components/pricing-cards.tsx`、`content/*`（pricing除外）。
- 交互实现：`components/auth-provider.tsx`、`components/generator/*`、`components/video-card.tsx`、`components/showcase-grid.tsx`、`components/ui/*`、歌曲/Showcase/登录/注册页面、独立 `app/interactive.css`。
- 后端实现：`app/api/*`、`lib/server/*`、`lib/video-options.ts`、`lib/prompts/*`、`migrations/*`、`tests/*`、`worker.ts`、`.env.example`，不修改前端。

公共契约见 `lib/contracts.ts`；定价数据见 `content/pricing.ts`。前端不可含密钥，所有价格和积分由服务端复核。没有可用服务时显示明确错误，不生成假成功结果。

## 执行任务

- [ ] 1. 工程及公共配置：安装匹配OpenNext的Next版本、字体、组件库，建立类型、价格配置和Workers配置。
- [ ] 2. 页面重建：八个公开路由、相同信息架构、品牌、配色、字号/间距、导航和页脚，长文按目标站实际服务编写。
- [ ] 3. 交互重建：真实图片格式/大小校验、预览/删除/拖放、选择器、Google弹窗、视频弹窗、歌曲模式、加载/错误/空态。
- [ ] 4. 服务后端：Google OAuth会话、D1任务和账本、R2上传/读取、APIMart素材/视频/歌曲、Creem Checkout/Webhook、后台任务推进。
- [ ] 5. 素材：匹配8个视频、生成封面和Web优化副本；不覆盖原件。
- [ ] 6. 验证：关键计费/安全/任务状态测试先红后绿，TypeScript、Next构建、OpenNext构建和Workers预览，真实Chrome三档逐页验证。
- [ ] 7. 交付：CLONE_REPORT、CLONE_AUDIT、REPLACE_GUIDE，记录真实可用功能、未配置服务与截图差异。

## 必须覆盖的失败条件

1. 超过10MB/非图片输入拒绝；客户端和服务端均验证。
2. 参数篡改、未登录、余额不足不得创建收费任务。
3. 并发生成不透支；失败/取消只退款一次；不对不确定是否受理的上游创建请求盲目重试。
4. 无效Webhook签名、重复事件、错误金额/产品/订单身份不得重复加积分。
5. 相片和生成记录按用户隔离；提供给上游的媒体URL限时；OAuth状态和回跳地址校验。

## 决策记录

- 选OpenNext以沿用Next15 App Router并使用经支持的生产适配器；Cloudflare新推荐的vinext仍为beta，不为本次视觉复刻引入额外迁移范围。
- 使用D1和R2完成Cloudflare原生数据存储。
- 先做可审核的完整工程和本地预览；外部账户的创建、权限和发布动作按实际页面要求处理。
- 视觉基准来自真实DOM/截图，不使用AI推测颜色、FAQ样式或Showcase比例。

## 进度日志

- 原站侦察完成：8路由、24张基准截图、5张交互/首屏截图。
- 指定web-clone技能已安装并应用；源码搜索未发现原站可复用实现。
- Creem和全量套餐要求已确认；Cloudflare账号在linhao浏览器已登录。
