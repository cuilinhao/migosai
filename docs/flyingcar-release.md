# FlyingCar 上线与支付入口验收

## 发布

- 2026-10-17 23:51（Asia/Shanghai），[FlyingCar 内页](https://migosai.design/flying-car-ai-video-generator) 已发布至 100% 生产流量。
- 发布源码：`f7a3301c7c98846aa73cac0a408c20b6288a6443`，已推送 GitHub `main`。
- Cloudflare Worker 版本：`9ddc9b25-3e66-41df-85f7-cf6267f3c334`。
- 部署 ID：`b3dfffb9-9e12-4562-9d15-4d4b481cff51`。
- 发布前后所有运行时绑定及配置一致，10 项 Secrets 保留；正式数据库无待执行迁移。本轮没有修改支付配置、Price ID、密钥或生产数据库 schema。

## 配色与发布前检查

页面沿用 migosai 的暖米白 `#fbf6ee`、深棕正文 `#1d140e`、橙色强调色，涵盖主页、两篇文章、生成表单、确认弹窗、套餐卡片和页脚。原版布局、字体、图片视频保留；主题覆盖限制在 `.flyingcar-page`。

- `npm test`：64 个测试文件，1,098 项通过。
- `npm run typecheck`、`npm run cf:build`、`git diff --check`：通过。
- 独立发布审查：未发现可证实的 P0/P1/P2 发布阻断。
- 本地桌面/手机视觉检查通过；正式站 1440/390 像素宽度无横向溢出，5 个视频元素全部 `readyState=4`、无媒体错误，主视频正常播放。
- 线上 39 项 HTTP 检查通过：18 个六语言新页面（保留英文源正文）、既有首页/定价/Ozil/Rap、站点地图、匿名身份接口、13 个媒体文件，以及两个匿名受保护接口。新页 canonical 和唯一 H1 正确，匿名创建 Checkout/生成任务返回 401。

## 正式支付入口验收

通过现有正式登录会话，从 FlyingCar 套餐入口到 `/pricing`，逐个点击购买按钮：

| 套餐 | 正式金额 | 积分 | 收银台与银行卡表单 | 取消返回 |
| --- | ---: | ---: | --- | --- |
| Starter | USD 9.90 | 300 | 通过 | 通过 |
| Creator | USD 29.90 | 1,200 | 通过 | 通过 |
| Pro | USD 49.90 | 2,200 | 通过 | 通过 |
| Business | USD 99.90 | 5,000 | 通过 | 通过 |

四次均打开 `checkout.stripe.com` 正式收银台，商品名、金额和积分一致。保留的“Continue to Stripe checkout”兜底链接指向同一个 Checkout。四次从 Stripe 返回网站都出现取消提示，刷新后共享积分余额保持不变。

按本轮四个准确订单 ID 对生产 D1 进行只读核对：全部 `stripe/live`，正式 Checkout 已记录，金额分别为 990/2990/4990/9990 美分、积分匹配、状态均为 `pending`、payment 账本 0 条、发放积分 0。只查询本轮订单，没有读取其他客户订单。

匿名浏览器点击 Buy Starter 正常打开现有登录弹窗，没有创建订单。普通支付页面未捕获应用控制台错误。

## 外部限制与未执行项

- Starter 和 Pro 首次显示的 Stripe Link 账号验证码面板提示 “Too many attempts”。没有尝试验证码或重发，点击 “Pay without Link” 后银行卡表单正常显示。Creator 和 Business 直接显示银行卡表单。这是本次观测到的 Stripe Link 验证状态；不将它写成全部支付方式已验收。
- 内置浏览器的 Google One Tap 记录一次 FedCM token NetworkError；常规登录弹窗仍可打开，正式 Chrome 的已有登录会话和共享余额正常。没有改动认证代码，也未重新验收完整 Google OAuth 登录。
- 没有输入银行卡信息、点击最终 Pay 或实际扣款。因此本轮验证的是正式支付拉起、金额与取消路径，真实收款、Webhook 到账与支付后的积分发放仍不属于本轮实测结论。
- 没有发起真实付费 FlyingCar 生成。隐藏系统提示词不可获取等原迁移边界继续见 [来源说明](flyingcar-sources.md)。

截图、精确订单标识、原始收银台记录与部署日志保存在被 Git 忽略的 `.local-evidence/flyingcar-release-20261017/`；公开页面截图位于本地 `QA/flyingcar/production-theme.png` 和 `production-mobile.png`。这些账户证据未提交 GitHub。
