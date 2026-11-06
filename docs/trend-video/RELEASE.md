# 新年登顶与石头城堡内页上线记录

2026-11-06 用户确认本地测试无问题，授权提交 GitHub、上线，并要求更新 sitemap。

## 发布版本

- 发布源码：[`cf21cc49ba598b05ae86fd6be169308101708890`](https://github.com/cuilinhao/migosai/commit/cf21cc49ba598b05ae86fd6be169308101708890)，已推送 `origin/main`。
- Cloudflare Worker：`migosai`。
- 生产版本：`8f0e69d3-73a4-453b-b484-2e0ae8b79b8e`。
- 部署记录：`873d8dcb-f392-4b23-9afe-a4c617eaa30c`，2026-11-06 22:49:10（Asia/Shanghai），100% 流量。
- 发布命令：`npm run deploy`，退出码 0。现有域名、D1、R2、支付配置及每分钟 cron 保留。
- 发布前 `git fetch origin`、主分支祖先检查通过；145 个文件、2763 项测试再次全部通过，类型检查通过。发布命令重新完成生产构建。
- 远端迁移检查：`No migrations to apply`，没有执行生产数据库迁移。

## 正式地址与 sitemap

- [告别 2026，迎接 2027](https://migosai.design/goodbye-2026-welcome-2027)
- [石头变城堡](https://migosai.design/stones-to-castle-ai)
- [站点地图](https://migosai.design/sitemap.xml)

两页均有 en、ko、ja、fr、es、zh-TW 六语言版本。英文采用无语言前缀地址，其余版本分别添加语言前缀。

sitemap 通过现有 `publicPages` 与语言路由统一生成，新增 12 个 canonical URL，`lastmod` 均为 `2026-11-06`。正式 sitemap 共 771 条，无重复地址，新条目均包含对应的语言链接；未修改无关页面的更新时间。

## 生产验收

- 12 个新页面均返回 200，title、description、H1、正文语言、canonical、hreflang 和索引设置通过。
- 12 页 FAQ 结构化数据与可见问答一致，两张 OG 图片均可读取。
- 六语言首页与原有 Hotel Lobby SEO 基线一致。
- 匿名 `/api/me` 返回 200、`user=null`、零积分、`Cache-Control: no-store`；现有登录配置就绪。
- 浏览器已打开两个正式内页；新年场景切换到双画面后，选项及参考视频来源同步，播放器 readyState 为 3、无媒体错误。城堡页正常渲染，截图时未记录控制台 error。
- 本地桌面、平板和手机交互验证见 [本地验收记录](VERIFICATION.md)。生产浏览器补测中出现工具连接超时，恢复后保存了城堡正式页面截图；没有把未完成的生产手机及城堡播放补测记为通过。

HTTP 报告：`.local-evidence/new-effects/production-http-verification.json`，检查完成于 2026-11-06 22:51（Asia/Shanghai），`errors=[]`。截图：`.local-evidence/new-effects/production-stones.jpg`。原始日志与截图保持 Git 忽略。

## 验证边界与工作区

本次发布没有购买积分或执行付费视频生成；成片动作、数字精度和人物一致性不属于已验证结论。页面固定生成设置仍为 Seedance 2.5、10 秒、480p、9:16、静音、75 积分，第三方视频明确标为参考。

主项目目录已切换并同步到 `main`。原有 `next-env.d.ts` 开发类型引用改动已在构建后恢复，未包含在提交中。发布后补充本记录属于文档提交，不改变上述生产版本的运行代码。
