# Gangnam Style 内页

来源：https://gangnamstyle.io/ ，2026-10-27 获取。按用户指定 https://github.com/cuilinhao/claude-skill-web-clone 的真实源码侦察流程，复用公开 SSR 内容与部署 CSS 的布局；原应用 JavaScript 不执行。GitHub 搜索未找到原站源码仓库。

## 实现与范围

- 路径 `/gangnam-style-ai-video-generator`，六语言 UI 路由进入 sitemap；内容保留源站英文（根容器 `lang=en`），不伪称已翻译原站文章。
- 完整首页区块：Hero、ticker、三个样例、生成器、照片建议、三步指南、editorial、购买、11条FAQ、Guides。标题、说明、图片与视频基于实际原文。
- 原站导航/账号外壳使用 MigosAI；颜色映射到现有深色及紫色 tokens。购买区及支付相关FAQ使用实际 MigosAI 积分/套餐/Stripe，避免原站1积分和Waffo文案误导。主站首页SEO保持原值。
- 两个模板链接切换本页自拍/宠物模式；指南链接保留原站真实文章，另开窗口。
- 三条示例及全部首页图片自托管，见 `content/gangnam-style-assets.json` 的源URL、SHA256和大小；页面底部标注来源。Trio样例15秒有声，其余两条约8.04秒无声。
- 原站私有生成提示词与服务端不可访问。本站使用已托管原片作为固定视频参考，以原创人物替换提示词约束三人自拍开场、中→右→左近景和集体结尾；Kie Seedance 2.5，15秒静音。镜头拆解和公开资料见 `MOTION_REFERENCE.md`；无像素或人物一致性保证。
- 三图（朋友/宠物）或一图（自拍），7画幅，480p 150积分/720p 300积分。接口固定模型/时长/价格，检查照片所有权、真实尺寸、文件格式和同意；复用幂等账本、任务锁、审核及失败退款。

## 维护

- 内容：`content/gangnam-style-page.json`；来源DOM导入：`python3 scripts/gangnam-style-import.py <original.html>`。
- CSS：`node scripts/gangnam-style-scope-css.mjs <home-20bEAjAE.css>`。类名统一gns前缀，所有选择器限制在 `.gangnam-page`，通用section间距只作用于来源顶层区块。
- 前端：`components/gangnam-style/`；API：`app/api/gangnam-style/generations/route.ts`。
- 原始抓取、截图和浏览器记录位于忽略目录 `.local-evidence/gangnamstyle/`。

## 验收

基线2420测试通过；实现后2510测试通过，类型检查和Cloudflare生产构建通过。真实Chromium验证1440/768/390宽度无横向溢出、标题、11条FAQ、全部图片解码、视频播放/切换/声音、模板切换、画幅/清晰度、照片选择/移除/错误格式、未登录提交打开本站登录。
六语言首页title/description/H1与发布前生产记录逐项一致。独立代码审查无阻断项。

首次发布验收未执行真实付费生成或支付；2026-10-28 已补做一次真实供应商生成，见下方记录。后台签名资源顺序、站内任务状态和退款使用自动化测试验证。Google One Tap在无Google会话的headless浏览器中有FedCM提示，不是页面脚本异常。

发布后验证发现多语言catch-all未注册新页，已补齐映射并新增5项真实路由解析回归测试（先失败再修复通过）；发布验收以修正版为准。

## 正式发布记录（2026-10-27，Asia/Shanghai）

- 功能提交：`9286e3f`；多语言路由修正：`473b349`，均已推送 `origin/main`。
- 最终 Cloudflare Worker 版本：`f6f2e33e-8558-48df-a146-9ee1aa3cb798`，部署命令退出0，正式域名路由和cron保留。
- 正式站6个新页面HTTP 200，canonical/7项语言alternates/11条FAQ正确；10个素材均HTTP 200。
- sitemap HTTP 200，共693 URL，包含新页面6个语言地址。
- 六语言首页title/description/H1与部署前逐字相同。
- 正式站Chromium三断点无横向溢出、所有图片解码、视频readyState=4，页面JS错误0；样例切换、声音、三模板、画幅/分辨率和登录弹窗通过。匿名生成API返回401，未提交生成任务。
- 用户已明确确认沿用本站账户、积分及套餐。

## 真实生成补测（2026-10-28，Asia/Shanghai）

**该版本的效果验收已被否定。** 用户指出成片与原站完全不同；复查原片确认目标是手持自拍接力，旧提示词误写为固定全景骑马舞。下列记录只能证明第一次供应商调用和文件播放成功，不能证明复刻效果合格。修正改为固定视频参考，见 `MOTION_REFERENCE.md`。

用户明确要求生成一条测试。线上浏览器为余额0的游客钱包，因此使用临时 Cloudflare remote preview 运行当前源码的 `createKieGangnamStyleVideo`、`GANGNAM_STYLE_CONFIG` 和 `gangnamStylePrompt`，使用现有供应商密钥；没有修改生产用户、积分、数据库、媒体存储或正式部署。探针仅接受固定参数，采用短时随机凭证及一次性本地收据防重，测试完成后已关闭。

- 仅提交1次真实供应商请求：Seedance 2.5，朋友模式，三张本站公开示例人像，顺序中/右/左；15秒、16:9、480p、静音。
- 三张输入均HTTP 200、WebP、640×800，线上与仓库SHA256一致。
- 00:00:50提交，00:04:41查询到完成；供应商返回HTTP 200 / code 200，`costTime=207`。仅查询已有任务，无重提。
- 成片6,240,956字节，H.264 MP4，854×480，15.041667秒，无音轨；SHA256 `7eef541e96719a0305c2043972cb1b196ed7c1bb2288fb2d90e6f7ae48de11ff`。
- FFmpeg完整解码退出0。浏览器实际播放至结束：`currentTime=duration=15.041667`、`ended=true`、`readyState=4`、`error=null`。
- 检查0.1/3/6/9/12/14.5秒画面：三角色发型/服装可区分，位置稳定，中→右→左独舞及最后合舞符合当时错误的骑马舞提示词，但不符合原站自拍片；手部/面部细节仍有模型生成误差。
- 本次重新运行生成接口、任务、客户端提交、Kie解析共4组153项测试，全部通过。
- 真实供应商生成、下载和本地浏览器播放通过。本次未覆盖生产页面上传、积分扣减、SeeAPI审核、历史入库或支付；不能据此宣称生产完整付费链路已实测通过。

本地视频和播放截图：`.local-evidence/gangnamstyle/result/`；收据、源码哈希和详细验证：`.local-evidence/gangnamstyle/real-test/`，均Git忽略。没有上传密钥、临时凭证或带签名的结果URL。
