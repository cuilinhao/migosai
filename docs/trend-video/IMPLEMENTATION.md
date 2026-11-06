# 新年登顶与石子城堡内页

日期：2026-11-06。用户要求在现有 MigosAI 项目新增两个内页，参考 Kavel goodbye-2026-welcome-2027 与 GoEnhance stones-to-castle-ai，使用 insetPage-ai-video-generator skill。本机同名 skill 可读；提供的 GitHub 地址及 main/SKILL.md 返回 404。

## 任务约定

- 页面路径：`/goodbye-2026-welcome-2027` 与 `/stones-to-castle-ai`，沿用现有暗紫主题、导航、账户/游客钱包、积分套餐及历史。
- 六语言：en、ko、ja、fr、es、zh-TW，完整页面与生成状态、元数据、canonical/hreflang、sitemap和入口。
- 首发生成契约：一张授权照片，服务端固定已接入的 Kie Seedance 2.5，10秒、480p、9:16、静音。价格读取 getFlyingCarCost(10)。提示词依据公开视频观察编写，不声称获取参考站私有模板。
- 服务端模板注册表，POST `/api/trend-video/generations`；前端只提交效果、照片、肖像许可与幂等键。复用既有上传真实类型/尺寸/所有权验证、原子扣费、Kie任务、审核、私有存储及下载。
- 持久化 `trendEffect`、`workflowVersion`、完整冻结提示词；通过现有 flyingcar provider 分支执行，历史额外携带效果ID并隔离恢复。
- 不改首页主标题、正文、SEO与Hotel Lobby生成器。保护开始时已有 next-env.d.ts 修改。
- 初次实现授权为本地新增与验证。2026-11-06 用户确认测试无问题，并授权提交 GitHub 和上线；继续按现有生产部署流程执行。付费生成与购买不在本次发布范围内。

## 验收

页面：两个内页、六语言正文及SEO、桌面/平板/手机、示例播放、FAQ、语言切换、上传与错误态。
请求/业务：未知模板/参数拒绝、照片所有权、许可、固定报价、幂等恢复、旧版本恢复、任务与历史隔离；共享任务/审核/退款回归。
技术：相关测试、完整测试、typecheck、生产构建。
成片：没有付费生成证据时明确标记未验证，不以第三方示例替代本站结果。

## 来源

- https://www.kavel.ai/video/goodbye-2026-welcome-2027
- https://www.goenhance.ai/video-effects/stones-to-castle-ai
- 原始侦察与测试日志位于 git 忽略目录 `.local-evidence/new-effects/`。
