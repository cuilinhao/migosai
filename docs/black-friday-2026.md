# 2026 黑五活动维护说明

## 已实现方案

永久页面 `/black-friday`，支持 en、ko、ja、fr、es、zh-TW；以 AI video generator Black Friday 为主，图片生成和图生视频为同页辅助意图。英文 Title 为 `AI Video Generator Black Friday Deals 2026 | MigosAI`，单 H1 为 `AI Video Generator Black Friday 2026`。

活动按 UTC 从 2026-11-20 00:00 到 2026-12-02 00:00（不含结束时刻）。全部一次性积分包原价加赠 20%，新老用户均可重复购买。订阅及其常规年付优惠不变。

| 积分包 | USD | 基础 | 赠送 | 合计 |
|---|---:|---:|---:|---:|
| Starter | 9.90 | 300 | 60 | 360 |
| Creator | 29.90 | 1,200 | 240 | 1,440 |
| Pro | 49.90 | 2,200 | 440 | 2,640 |
| Business | 99.90 | 5,000 | 1,000 | 6,000 |

加赠 20% 相当于每积分价格下降约 16.67%，不能写成 20% OFF。仓库没有完整采购成本和支付手续费数据，该比例是活动设计建议，尚无实际毛利测算。

## 核心文件

- `content/black-friday-offer.ts`：UTC 状态、统一报价、不可修改的历史活动定义。
- `content/black-friday-copy.ts` / `lib/i18n/messages/black-friday.ts`：英文源文案和五种翻译。
- `app/black-friday/page.tsx`：预告、生效、结束状态及可见 FAQ 同源的 JSON-LD。
- `components/black-friday/`：样式、活动入口、CTA 统计、定价页积分包选择。
- Stripe/Waffo 在创建结账时计算赠分，冻结到 `orders.credits`；支付完成通知沿用已有严格校验和防重发放。客户端 `expectedCredits` 仅防止旧页面提交过期报价。

不需要新增数据库迁移、Stripe Price 或优惠码。部署这版代码后，到开始时刻按服务器时间自动生效，结束时刻恢复常规报价。已创建且仍有效的结账按冻结额度完成。不要为赶活动直接改变服务器时钟或移除付款验证。

退款仍由客服按现有政策人工复核和对账。获批退款应处理对应订单的基础与赠送积分，不能只收回基础积分；支付商退款通知本身不会自动改余额。

明年新增活动应给历史 registry 追加新 ID，再选择新活动并更新文案与翻译。不要覆盖 2026 的历史赠分规则，否则旧订单延迟回调和复核可能受影响。URL 保持 `/black-friday`。

## SEO 与统计

主页、定价页、博客入口和 Portal 页脚均有链接；公共页面清单自动生成六语言 sitemap 与 hreflang，包含 x-default。页面有 WebPage、BreadcrumbList、FAQPage；13 个 FAQ 的结构化数据来自实际显示的翻译内容，不承诺搜索引擎一定展示富结果。

CTA 指向 `/pricing?promo=blackfriday#credit-packs`，自动选择积分包。该参数不决定赠分资格，不使用内部 UTM 覆盖原始获客来源。现有 GA4 加载时记录 `black_friday_cta_click`，带 campaign_id、placement、destination；未新增 GA4 purchase 事件。活动订单的基础/赠分/活动 ID 可在支付商 metadata 中核对。

已于 2026-10-25 发布，并完成正式地址与 Stripe 沙盒付款验收；未提交 GSC、未发生真实扣款。搜索收录与排名并非部署后立即发生。

## 验证记录（2026-10-25）

- `npm test`：106 个测试文件、1,775 项测试全部通过，包含付款快照、UTC 边界、跨期支付、防重、过期报价、旧购买入口和六语言 SEO/FAQ。
- `npm run typecheck`：通过。
- `npm run cf:build`：通过，包含 Next 生产构建和 OpenNext Worker 打包。保留仓库既有 middleware/proxy 弃用及 Next Edge process.cwd 构建警告。
- `wrangler dev` 运行实际生产包：英文桌面、390px 中文手机、Canonical、语言链接、FAQ 展开、定价页积分包入口已检查，无横向溢出。
- 独立审查发现 Hotel Lobby 内嵌积分卡漏传报价时间，已修复并加入回归测试。
- 初始五个 Worker 测试因本地 workerd 原生文件缺失无法运行；通过该依赖自带安装脚本补齐后全部通过，未变更依赖版本或锁文件。

## 正式发布与购买验收（2026-10-25）

- Cloudflare Worker 版本 `777a5f57-77e5-43c2-9ad2-63fdcb2be11c`，北京时间约 11:30 发布至 `migosai.design` 和 `www.migosai.design`。之前版本为 `33411893-dcd5-4aeb-996a-a69e79ab3e29`。运行时 bindings 完全一致，10 项 Secrets 保留，无新增数据库迁移。
- 修复定价卡片高亮固定在 Creator / Pro 的问题：点击卡片内容或标题切换选中状态，标题支持键盘，购买按钮仍只购买对应套餐，Elite 档位控件不会误触外层选择。
- 本轮全量 106 个文件、1,786 项测试通过，包含新增 4 项卡片和 7 项实际 Worker 支付回归。类型检查、Cloudflare 生产构建、diff 检查通过。首次独立类型检查与 Next 构建并行时遇到生成文件暂时缺失，构建后顺序重跑通过；无源码类型错误。
- 正式浏览器逐张切换 Starter、Creator、Pro、Business，文本区域及空格键选择通过。黑五入口自动选择积分包，FAQ 可展开；英文桌面及 390px 英文、繁体中文页面无横向溢出。
- 正式 SEO 共 117 项通过：六语言 title/description、单 H1、canonical、7 个 hreflang、13 个 FAQ 与 JSON-LD 一致，18 个站内入口、robots、sitemap、www 重定向和图片资源正常。一个图片首次请求网络异常，后续两次 200；法语、西语 description 较长，搜索摘要可能截断。
- 正式 Starter 收银台显示 $9.90 / 300 积分，取消后本次订单仍为 pending，付款账本 0 条。仅对本次精确订单作生产只读查询，未扣款、未手工改余额。今天在活动前，因此常规额度正确。
- 使用隔离的本地 workerd/D1 与真实 Stripe sandbox，只有创建结账的报价时钟设为活动期；付款验证和签名验证保留真实时间。浏览器用 Stripe 官方测试卡完成 $9.90 付款，自动签名回调 HTTP 200，订单 paid，余额 0 → 360（300 + 60），付款账本一笔。
- 同一真实支付事件并发重放 6 次均返回 200，余额仍为 360、账本仍一笔。四档额度、活动起止边界、过期报价 409、跨期付款保留开单时额度、重复购买可再享加赠由自动化覆盖；本轮真实测试卡实付验证的是 Starter。
- 沙盒沿用此前测试商品的 LobbyDuo / 300 Credits 名称，收银台本次额外提示明确显示 360 总积分及 60 黑五赠分；未修改正式 Stripe 商品或价格。测试不移动真实资金，生产日期未提前调整。

发布日志、只读 SEO 报告及脱敏沙盒账本证据保存在本次聊天的 `work/black-friday/`。页面和到账截图在本次聊天的 `outputs/`；不将密钥、付款页面访问凭据或客户数据提交 Git。

## 方案参考

- [Textideo 官方活动页](https://textideo.com/black-friday)：借鉴原价增加积分的形式。
- [Veida 官方活动页](https://veida.ai/black-friday)：借鉴基础额度与额外额度的清晰展示。
- [Imya 官方活动页](https://imya.ai/black-friday)：借鉴新老用户、续费和积分有效期的说明。

以上只核对官网公开说明，没有验证其实际付款或到账；不采用竞品的无限权益、折扣幅度或利润假设。
