# Gangnam Style 内页

来源：https://gangnamstyle.io/ ，2026-10-27 获取。按用户指定 https://github.com/cuilinhao/claude-skill-web-clone 的真实源码侦察流程，复用公开 SSR 内容与部署 CSS 的布局；原应用 JavaScript 不执行。GitHub 搜索未找到原站源码仓库。

## 实现与范围

- 路径 `/gangnam-style-ai-video-generator`，六语言 UI 路由进入 sitemap；内容保留源站英文（根容器 `lang=en`），不伪称已翻译原站文章。
- 完整首页区块：Hero、ticker、三个样例、生成器、照片建议、三步指南、editorial、购买、11条FAQ、Guides。标题、说明、图片与视频基于实际原文。
- 原站导航/账号外壳使用 MigosAI；颜色映射到现有深色及紫色 tokens。购买区及支付相关FAQ使用实际 MigosAI 积分/套餐/Stripe，避免原站1积分和Waffo文案误导。主站首页SEO保持原值。
- 两个模板链接切换本页自拍/宠物模式；指南链接保留原站真实文章，另开窗口。
- 三条示例及全部首页图片自托管，见 `content/gangnam-style-assets.json` 的源URL、SHA256和大小；页面底部标注来源。Trio样例15秒有声，其余两条约8.04秒无声。
- 原站私有生成提示词与服务端不可访问。本站使用原创固定三人骑马舞提示词，明确中→右→左独舞顺序，Kie Seedance 2.5，15秒静音；无像素或人物一致性保证。
- 三图（朋友/宠物）或一图（自拍），7画幅，480p 150积分/720p 300积分。接口固定模型/时长/价格，检查照片所有权、真实尺寸、文件格式和同意；复用幂等账本、任务锁、审核及失败退款。

## 维护

- 内容：`content/gangnam-style-page.json`；来源DOM导入：`python3 scripts/gangnam-style-import.py <original.html>`。
- CSS：`node scripts/gangnam-style-scope-css.mjs <home-20bEAjAE.css>`。类名统一gns前缀，所有选择器限制在 `.gangnam-page`，通用section间距只作用于来源顶层区块。
- 前端：`components/gangnam-style/`；API：`app/api/gangnam-style/generations/route.ts`。
- 原始抓取、截图和浏览器记录位于忽略目录 `.local-evidence/gangnamstyle/`。

## 验收

基线2420测试通过；实现后2510测试通过，类型检查和Cloudflare生产构建通过。真实Chromium验证1440/768/390宽度无横向溢出、标题、11条FAQ、全部图片解码、视频播放/切换/声音、模板切换、画幅/清晰度、照片选择/移除/错误格式、未登录提交打开本站登录。
六语言首页title/description/H1与发布前生产记录逐项一致。独立代码审查无阻断项。

未执行真实付费生成或支付。后台provider请求、签名资源顺序、任务状态和退款使用自动化测试验证；真实模型输出不在本轮验收结论内。Google One Tap在无Google会话的headless浏览器中有FedCM提示，不是页面脚本异常。

发布后验证发现多语言catch-all未注册新页，已补齐映射并新增5项真实路由解析回归测试（先失败再修复通过）；发布验收以修正版为准。

## 正式发布记录（2026-10-27，Asia/Shanghai）

- 功能提交：`9286e3f`；多语言路由修正：`473b349`，均已推送 `origin/main`。
- 最终 Cloudflare Worker 版本：`f6f2e33e-8558-48df-a146-9ee1aa3cb798`，部署命令退出0，正式域名路由和cron保留。
- 正式站6个新页面HTTP 200，canonical/7项语言alternates/11条FAQ正确；10个素材均HTTP 200。
- sitemap HTTP 200，共693 URL，包含新页面6个语言地址。
- 六语言首页title/description/H1与部署前逐字相同。
- 正式站Chromium三断点无横向溢出、所有图片解码、视频readyState=4，页面JS错误0；样例切换、声音、三模板、画幅/分辨率和登录弹窗通过。匿名生成API返回401，未提交生成任务。
- 用户已明确确认沿用本站账户、积分及套餐。
