# Local clone audit

- No PicLumen/Recraft runtime code, private endpoints, analytics or account data copied. Existing MigosAI Google Analytics integration retained.
- MigosAI brand is used throughout the visible portal, tools, articles, auth UI and dashboard. Legacy translation keys and asset paths remain stable; rendered product copy uses the current brand.
- Solutions, Canvas and Text do not appear in portal navigation or feature cards. Unavailable tools and Quests are marked Coming soon; no placeholder `href="#"` links.
- New asset source manifest contains only public remote URLs/public local paths. Host temporary paths and secrets are not published.
- Font licenses are preserved in `font-licenses/`.
- Reference media licenses are not assumed from public availability. Local preview only until rights are confirmed or images replaced.
- No fabricated testimonials, customer counts, top creators or client logos.
- Final test/build limits and deployment prerequisites are recorded in CLONE_REPORT.md.

## 2026-10-22 — 统一全站视觉

- 根据用户预览反馈，将 Hotel Lobby、Flying Car、Özil、音乐、定价、博客、法律及联系页接入同一 PortalShell；去除旧工具页重复导航与页脚，独有说明保留在正文。
- 全站使用深色背景、紫粉渐变、DM Sans、统一卡片与表单。Hotel Lobby 保留完整内容、示例及生成器，移除旧橙色页面背景、倾斜卡片、立体阴影与额外导航留白。视频素材和场景示意保留原色。
- 登录与账户界面同步统一；/landing 保留 Recraft 结构和展示标题字形，品牌图标、正文字体、按钮和主题色与 MigosAI 一致。
- 修正工具子页与定价导航当前状态，以及平板 Flying Car 确认弹窗层级和 Özil 底部按钮与侧栏的布局关系。
- 验证：77 个测试文件、1369 项回归通过；随后品牌与定价标记调整的 140 项界面测试通过；19 个改动 CSS 文件解析通过。桌面 1440px、平板 768px、手机 390px 实测主题和布局；抽查页面未发现整页水平溢出。确认设置/预审弹窗、上传入口和登录入口，未发起付费生成或支付。
- Next.js 生产构建及 OpenNext 本地兼容构建通过；仍沿用 CLONE_REPORT.md 中记录的现有 Next.js 版本支持期限制。未部署远程环境。

## 2026-10-22 — 全部内页巡检

- 范围：58 个基础页面（包含首页及 landing），以及本地化页面；生成工具、指南、博客、账户、定价、联系及政策页均纳入。
- 最终生产预览 HTTP 复核：58 个基础路径加 43 个路径的 5 种语言版本，共 273/273 返回 200，问题数 0。页面标题/main、canonical、站内链接/锚点、本地媒体及品牌检查通过。
- 修复 Özil 博客的 Hub 导航高亮与 Showcases 的 Explore 高亮；补齐账户视频工具的页面标题、当前导航标记及手机菜单的 Escape 关闭/焦点返回。
- 统一可见正文、博客来源、结构化数据及 Open Graph 中的 MigosAI 品牌。旧翻译键和素材路径保留；品牌替换在用户变量插值前执行，不改写用户输入。
- Hotel Lobby 推荐设置费用引用现有 Wan 计费函数（5 秒、480p 为 30 积分）；修正登录方式、示例来源及共享积分说明。图片仍为 1K/2K/4K 对应 5/8/12 积分，套餐价格及政策未变。
- 音乐工具修复重复提交、活动任务锁定、响应未知时保持同一请求重试、重新进入页面恢复活动任务。图片与音乐均保留匿名登录时的表单草稿，切换账户清理私人草稿与结果；参考文件与上传任务继续按账户隔离，已保存图片任务优先恢复其原参数。账户列表加载失败可重试，账户切换时立即隐藏旧账户数据。
- Flying Car 预审关闭后焦点返回触发按钮；相关关闭、移除与媒体按钮扩大触控区域。
- 浏览器检查覆盖全部基础页面的 390、768、1440px；另抽查 5 种语言的 30 个手机页面及 8 个 320px 窄屏页面。未发现整页水平溢出、破图或正文裁切。Flying Car 透明文件输入与 Özil 装饰滚动条引起的检测提示已人工核实为预期行为。
- 实际交互验证：Flying Car 预审打开/Escape/焦点返回、账户手机菜单打开/Escape/焦点返回、音乐自定义表单及登录弹窗草稿保留。未发起真实登录、付费生成、支付或远程部署；这些业务状态通过现有单元与接口回归验证。
- 验证：排除并行「复刻 Ideogram 落地页」任务正在修改的 landing 测试文件，85 个测试文件、1441 项通过。完整工作区测试另有 1 个 landing 新功能断言失败，未覆盖或改动该任务的文件。TypeScript、Next.js 生产构建及 OpenNext 本地兼容构建通过。
- 本地截图与结构检查证据：`.local-evidence/piclumen-recraft/all-page-audit/`；完整 HTTP 复核记录：`http-final.json`。预览使用本地 Wrangler 存储。
