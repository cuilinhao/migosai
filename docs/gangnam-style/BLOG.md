# Gangnam Style 常见问题博客

2026-10-28：用户要求新增10篇针对Gangnam Style用户问题的博客并更新sitemap。文章按现有站点英文内容撰写，使用独立专题博客结构。

## 文章

1. [What Is Gangnam Style? The Song, Dance and AI Trio Explained](https://migosai.design/gangnam-style-ai-video-generator/blog/what-is-gangnam-style)
2. [What Does Gangnam Style Mean? Gangnam, Oppa and the AI Template](https://migosai.design/gangnam-style-ai-video-generator/blog/what-does-gangnam-style-mean)
3. [How to Make a Gangnam Style AI Video from Your Photos](https://migosai.design/gangnam-style-ai-video-generator/blog/how-to-make-gangnam-style-ai-video)
4. [Best Photos for a Gangnam Style AI Video: A Practical Upload Guide](https://migosai.design/gangnam-style-ai-video-generator/blog/best-photos-for-gangnam-style-ai-video)
5. [How to Make a Gangnam Style AI Video from One Selfie](https://migosai.design/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-from-one-selfie)
6. [How to Make a Gangnam Style AI Pet Video with Three Photos](https://migosai.design/gangnam-style-ai-video-generator/blog/gangnam-style-ai-pet-video)
7. [Gangnam Style AI Video Prompts: Three Friends, One Selfie and Pets](https://migosai.design/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-prompt)
8. [Gangnam Style AI Video Music: What Sound Is Included?](https://migosai.design/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-music)
9. [Gangnam Style AI Video Format and Resolution: 480p or 720p?](https://migosai.design/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-format-resolution)
10. [Gangnam Style AI Video Cost, Failed Jobs and Common Fixes](https://migosai.design/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-cost-and-fixes)

## 接入与约束

- 新增专题索引和10篇正文，保留现有MigosAI主题。每篇含答案、分节、目录、FAQ、来源、相关文章及生成器入口。
- 生成器导航、教程链接与总博客增加入口；侧栏正确标记Hub。
- 日期为实际发布日。文章只提供已撰写的英文版本，语言前缀永久重定向至真实页面；canonical、hreflang和sitemap保持一致。
- sitemap新增11个真实URL，总数由693变为704；更新总博客和此前隐私说明的实际lastmod。
- 内容与当前产品一致：访客钱包/账户、照片限制、固定16:9、480p/720p、约15秒参考、自动音轨。正文价格读取getGangnamStyleCost，未改变生成、支付或退款流程。
- 历史事实引用PSY官方视频、YouTube官方文章及韩国官方资料。音乐文件、音乐授权和Shorts格式分别说明，未承诺平台收录或收益。

## 验证

- 全量137文件/2616项测试通过；类型检查与差异格式检查通过。
- 本地20项HTTP检查通过：11页、schema与canonical、404、5语言重定向、sitemap及入口。
- 浏览器确认索引卡片、正文、目录与Hub选中状态。
- 证据保存于Git忽略目录.local-evidence/gangnamstyle/blog-20261028/。
- OpenNext/Cloudflare正式构建完成。

## 上线验收

代码提交 `76c183d`；Cloudflare生产版本 `7274a0da-84f2-4d8f-951b-f2163d1e4a5b`。

- 生产20项HTTP检查全部通过：10篇文章及索引、canonical/hreflang、BlogPosting结构化数据、未知slug404、5语言别名308、生成器及总博客入口。
- sitemap返回200，704个去重URL，新增11个博客地址的lastmod均为2026-10-28。
- 六语言首页标题、描述、H1与原基线一致；更新前后均通过。
- 浏览器确认正式索引及10张文章卡片，原主题保留，Hub选中，控制台无error。生产截图已保存。

## 完整视频提示词教程（2026-10-28）

用户要求把视频提示词加入博客。将第7篇提示词文章扩充为完整教程，保留原URL：

- 三人、单人自拍、宠物三套完整提示词，直接读取生产使用的 `gangnamStylePrompt()`，避免文本漂移。
- 解释 `@Video1`、三张照片的角色映射、每个镜头时间段、外部编辑器的参考素材要求及本站自动应用流程。
- 解释模型生成阶段静音、随后由FFmpeg合入参考音轨；未声称获得原站私有提示词。
- 增加可选择复制的原文代码块，自动换行，支持键盘聚焦和辅助阅读名称。代码正文不进行翻译或内联标记解析。
- 更新文章标题、摘要、FAQ与结构化数据；sitemap保留该正式地址，10篇文章与索引共11个地址，总URL仍为704，lastmod为同日2026-10-28。
- 验证证据：`.local-evidence/gangnamstyle/prompt-blog-20261028/`。
- 发布前验证：137文件/2618项测试、类型检查、差异格式检查及Cloudflare正式构建全部通过；本地20项HTTP检查通过，浏览器确认三套原文完整显示且无横向溢出。
