# Gangnam Style 六语言适配

2026-10-28，修复内页只有站点外壳翻译、博客语言地址跳回英文的问题。

## 内容与路由

- 遵循本站语言配置：en、ko、ja、fr、es、zh-TW。英语使用原内容，另外五种语言各435条博客文案、268条内页/生成器文案。
- 内页覆盖所有段落、操作、媒体说明、11条FAQ、上传与生成状态、合音进度、动态错误、辅助阅读标签和SEO。价格、账户/游客钱包、套餐复用本站逻辑。
- 10篇博客逐项翻译标题、摘要、段落、表格、FAQ、来源标签和相关链接；日期使用当前语言格式。提示词文章的三套可执行提示词保留生产函数英文原文，翻译周围解释。
- 新增语言catch-all的专题索引与文章slug解析；语言切换和文章内链保留当前文章、query与hash。Ozil的原语言博客策略保持原样。
- canonical指向当前语言页面，hreflang包含六语言与x-default；FAQ、BlogPosting和BreadcrumbList使用本页语言及地址。
- sitemap共759个去重URL（此前704），包含6个生成器页面、6个博客索引及60篇文章；新译文lastmod为2026-10-28。

## 维护位置

- `lib/i18n/gangnam-style.ts`及`messages/gangnam-ui/`：客户端及内页文案。
- `lib/i18n/gangnam-blog.ts`及`messages/gangnam-blog/`：服务端博客翻译，长文不进入生成器客户端包。
- `components/gangnam-style/use-translations.ts`：共享错误翻译回退及含宽高的图片校验提示。按字典键判断是否命中，不能用插值后的结果判断，否则共享HTTP错误会漏翻。
- `tests/gangnam-style-translations.test.tsx`：从真实内容提取键，验证完整性、链接、占位符、正文语言和原文提示词；客户端与路由测试另覆盖合音状态、实际语言解析、语言切换和sitemap。

## 验证记录

- 全量138文件、2633项测试通过，类型检查与`git diff --check`通过。
- OpenNext/Cloudflare正式构建成功，构建前已fetch并确认`origin/main`为当前HEAD祖先。
- 本地72/72真实HTTP页面通过：正文、title/description/H1、canonical、7项hreflang、JSON-LD、价格插值及原文提示词；sitemap759条、72目标地址齐全无重复，六语言未知slug均404。
- 六语言Hotel Lobby首页的title/description/H1与已有生产基线逐字一致。浏览器验证繁中/法语手机、繁中/日语桌面、西语平板、韩语手机无横向溢出；模式切换、中文FAQ和日语文章语言切换保留原slug/hash。
- 本次只修改显示、路由与SEO，没有改变生成提示词、模型、报价、参考视频或FFmpeg后处理；没有新增付费生成。
- 验证脚本、HTTP结果和浏览器截图保存在忽略目录 `.local-evidence/gangnamstyle/i18n-20261028/`。
- 个人skill `insetpage-ai-video-generator`已加入完整语言范围、正文/状态/SEO清单、语言内链和上线矩阵要求；skill格式校验与23项HTTP辅助脚本测试通过。

## 正式发布与验收

- 功能提交`1543cb2`已推送`origin/main`，主项目已切回并同步`main`；用户原有`next-env.d.ts`修改保留且未提交。
- Cloudflare Worker版本`7a813ba5-95ef-4876-aeaa-d1d4f0cf0eeb`，部署退出0，正式域名与原触发器保持正常。
- 正式域名72页全部完成内容、语言、SEO及提示词检查：首轮70页通过；韩语提示词文章遇到curl SSL连接错误、繁中音乐文章遇到本地Python解析超时，定向复测两页均通过。原始失败与复测报告分别保留，未重新部署或重新生成视频。
- 生产sitemap返回200，759个去重地址，72个目标页面齐全；六语言未知slug均404。六语言旧首页title/description/H1与基线逐字一致。
- 正式浏览器确认完整繁中内页、10张博客卡片、示例视频readyState=4、中文声音状态与muted值一致；控制台error为0。截图`production-zh-TW.png`保存在本地证据目录。
