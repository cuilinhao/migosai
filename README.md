# Migos AI

运行于 [migosai.design](https://migosai.design) 的双图视频与音乐生成应用。前端使用 Next.js 15 / React 19，服务端由 OpenNext 部署到 Cloudflare Workers，D1 保存账户、任务和积分账本，R2 保存私有媒体。

## 当前功能

- 英文、韩文、日文、法文、西班牙文、繁体中文六种语言；英文使用无语言前缀路径。
- Google 登录后首次赠送 50 积分，重复登录不重复赠送；保留历史余额与赠送记录。
- 视频支持 Wan 3.0、Seedance 2.0、Seedance 2.0 Fast，以及四种舞台、画幅、时长、清晰度、动作和声音设置。模型不兼容的组合由界面联动调整，服务端再次校验。
- 浏览器裁剪、预览并转码自选动作或歌曲，服务端核验文件、时长及所有权。参考素材影响生成结果，不保证逐帧动作或逐样本音频复制。
- 新视频使用 Kie；音乐及切换前的历史视频任务保留 APIMart 路径。视频通过 SeeAPI 审核后才开放读取。
- Waffo Pancake 提供四档一次性积分包。商户配置已完成，但正式创建付款仍因商户审批返回 403，尚无生产交易验收。

默认视频为 Wan、Hotel Lobby、10 秒、480p、9:16，使用模板时消耗 60 积分；5 秒 480p 模板消耗 30 积分。最终价格以服务端验证后的参数和参考片段时长为准。50 欢迎积分不足支付默认组合，需要调整设置或购买积分。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm ci
npm run dev
```

页面开发服务位于 `http://127.0.0.1:3000`。验证真实 Workers、D1 与 R2 行为时，将 [`.env.example`](.env.example) 复制为被忽略的 `.dev.vars` 并填写本地配置，然后运行：

```bash
npm run db:local
npm run preview
```

只有公开页面展示可在缺少服务配置时独立预览；登录、生成和支付需要对应服务。未配置的接口返回明确错误。

## 验证与部署

```bash
npm test
npm run typecheck
npm run cf:build
```

可复现检查和浏览器验收步骤见 [QA 说明](QA/README.md)。2026-10-03 本轮整理前的验证基线为 550 项自动测试及类型检查通过；三个模型的真实生成和浏览器播放已通过。Chrome 下载到本地文件仍未验收通过，不能据此宣称完整下载链路可用。测试数量记录对应当时的源码，后续以重新执行结果为准。

部署配置位于 [`wrangler.jsonc`](wrangler.jsonc)，密钥使用 Workers Secrets；不把 `.dev.vars`、账户截图、原始订单或生产检查日志提交到 Git。迁移、发布和支付验收步骤见 [配置与维护指南](REPLACE_GUIDE.md)。

## 代码入口

| 路径 | 用途 |
| --- | --- |
| `app/`、`components/` | 公开页、账户页、交互和 API 路由 |
| `content/`、`lib/i18n/` | 页面内容、六种语言、路由与翻译 |
| `lib/video-options.ts` | 视频参数、兼容规则与报价 |
| `lib/server/` | 认证、积分、付款、生成、审核与媒体 |
| `migrations/` | D1 数据库迁移 |
| `public/templates/hotel-lobby/` | 内置动作与声音参考素材及来源说明 |
| `tests/`、组件旁的 `*.test.*` | 自动化回归测试与合成素材夹具 |
| `scripts/check-geo.py`、`scripts/check-i18n.mjs` | 只读页面与抓取检查 |

维护决策见 [NOTES](NOTES.md)，实现范围见 [范围说明](docs/replica-scope.md)，已知验收边界见 [交付审计](CLONE_AUDIT.md)。
