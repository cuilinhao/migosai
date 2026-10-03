# GEO 页面维护说明

当前站内实现包含六个 Hotel Lobby 内容页，覆盖英文、韩文、日文、法文、西班牙文和繁体中文。本文替代早期发布流水；历史测试截图与报告仅保存在本地归档。

## 页面与来源

- `/hotel-lobby-ai-video-generator`
- `/hotel-lobby-ai-video-generator-free`
- `/hotel-lobby-ai-template`
- `/hotel-lobby-ai-filter`
- `/hotel-lobby-ai-generator`
- `/blog/best-hotel-lobby-ai-video-generators-2026`

各页保持独立主题、服务端正文、内部链接、canonical、hreflang 与 FAQ 结构化数据，并纳入 sitemap 和 `public/llms.txt`。竞品陈述的来源与核验边界见 [来源记录](geo-sources.md)；更新陈述时需重新核对对应来源。

## 当前产品事实

免费说明使用一次性 50 欢迎积分，不宣称每日免费重置、无需登录或所有设置均免费。默认 Wan 10 秒 480p 模板需要 60 积分，5 秒 480p 模板需要 30 积分；费用以服务端报价为准。页面介绍的声音、动作和舞台能力需与生成器保持一致。

比较文章明确属于本站内容，不编造用户评分、成功率或竞品实测结果。旧任务书中的 10/100 欢迎积分、仅五种语言及旧视频报价不再作为当前依据。

## 复现检查

启动本地页面服务后执行：

```bash
python3 scripts/check-geo.py http://127.0.0.1:3000
node scripts/check-i18n.mjs http://127.0.0.1:3000
```

脚本检查页面抓取契约、多语言路由与 sitemap；浏览器仍需检查窄屏布局、链接和语言切换。完整验证入口见 [QA 说明](../QA/README.md)。这些检查不证明搜索引擎已收录、已获得排名或会被 AI 引用；收录和曝光需要使用实际站点数据另行观察。
