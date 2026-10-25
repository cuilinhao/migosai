<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git 提交

Git 提交标题和正文使用中文；用户另有明确要求时以用户要求为准。

## 生产发布

- 发布前先 `git fetch origin`，确认 `git merge-base --is-ancestor origin/main HEAD` 成功。禁止从落后于主分支的目录构建或发布。
- 新功能必须合并现有主分支修复后再测试、提交和发布；不能用旧目录中的未提交功能覆盖生产版本。
- `/` 及六语言首页必须保留 Hotel Lobby 内容、原 SEO 标题/描述/H1、内链和生成功能。发布验收同时检查首页与本次修改的页面。
- 隔离工作树发布完成后，同步主项目目录；先备份并确认保留本地修改，避免下一次又从旧目录发布。
