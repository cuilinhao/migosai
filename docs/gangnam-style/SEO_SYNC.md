# Gangnam Style SEO/GEO 同步

2026-10-30，将独立站已验证的SEO/GEO改进适配回MigosAI内页。

## 保留主站结构

- `/` 与六语言首页继续使用 Hotel Lobby 内容；根 `/blog` 保留主站文章。
- Gangnam 的生成器、专题索引和10篇文章继续使用 `/gangnam-style-ai-video-generator` 及其 `/blog` 子路径。无需重定向，也不新增重复落地页。
- 工作室、三种模式、11条FAQ、媒体、账户/游客钱包、套餐、支付、模型、提示词、音轨处理与原GA4身份保持原实现。
- 原文章正文、素材来源、署名及2026-10-28文章日期保留。

## 同步内容

- `lib/seo.ts`统一六语言canonical/hreflang，供共享metadata、Gangnam博客及sitemap使用；Ozil独立语言变体保留。
- 工作室前增加六语言语义规格表。比例、分辨率、参考时长和480p/720p点数读取生产配置，当前为16:9、约15秒、150/300点数；含範本音轨说明。
- Gangnam页面与文章声明MigosAI Organization/WebSite；主内页另有WebPage和SoftwareApplication，采用MigosAI实际logo与稳定实体ID，明确与歌曲/艺人的区别。主站首页不输出Gangnam实体。
- 专题索引H1包含Gangnam关键词；原口号保留。主内页的3张精选卡片加7篇简洁链接覆盖全部10篇，文章顶部CTA到父内页，底部CTA到该内页工作室。
- robots仅新增六语言guest-wallet排除。llms修正原“silent MP4”描述，增加产品事实、10篇指南和语言路径说明。
- sitemap地址、顺序及其他页面日期不变；仅实际修改的Gangnam主内页与索引共12条lastmod更新到2026-10-30。
- 六语言404复用主站外壳；Gangnam未知地址提供专题博客入口，其他地址返回主博客。

## 验证与发布顺序

先测试，再推送GitHub，最后部署Cloudflare Worker `migosai`。

- 全量Vitest：141文件、2684项通过；类型检查通过；OpenNext生产构建通过。
- `node scripts/check-gangnam-seo.mjs --baseUrl http://127.0.0.1:8787 --phase local`：72个实际HTTP页面通过，覆盖正文、语言、标题、canonical、7项hreflang、OG URL、实体、FAQ与原文提示词；759条sitemap无重复；六语言未知slug为404+noindex；robots与llms检查通过。
- 六语言Hotel Lobby首页title/description/H1与生产基线逐字一致。
- 浏览器检查桌面内页、繁中手机规格表与宠物模式、英语自拍模式及480p报价、法语手机博客/404；1280px与390px均无水平溢出，样例媒体正常加载，console error为0。
- Next 16未知动态slug在metadata阶段抛出notFound时，原始HTML可能只有错误壳；自定义404由客户端完成渲染，已用真实浏览器验证恢复链接。HTTP状态与noindex另行验证。
- 本次没有变更生成/账务链路，没有重复发起付费生成。
- 独立代码审查未发现阻塞问题。构建、HTTP报告和浏览器截图保存在忽略目录 `.local-evidence/migos-seo-sync-20261030/`。

发布后使用相同检查脚本对 `https://migosai.design` 复验。完整发布日志中的版本ID与Git提交应一并保存到本地证据目录。GSC重新提交及请求索引仍按原文档留给用户手动操作。
