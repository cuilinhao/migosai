# MigosAI /landing 实现记录

本次接续未完成的 Ideogram 落地页复刻。参考为 `docs/ideogram-clone/RECON/original.html`、`original.css` 与 `screenshots/original-desktop.png`、`original-full.png`，使用已有 `landing-content.ts` 数据与 `public/landing/ideogram/` 本地资源。静态营销页按视觉复刻实现，未引入原站运行脚本或外部服务。

## 页面与交互

- `/landing` 保留既有入口与 `RecraftLanding` 导出名；根路径门户、计费支付和 package 均未修改。
- 保留原截图的全幅图片首屏、叠加导航、左下衬线标题和右下视频入口；后续为白底三栏产品、居中特色模型、紫色功能区、深色视频区、作品瀑布流、FAQ 和浅紫渐变页脚。
- 原先花卉主图内置 Ideogram 花字，故轮播仅选用现有无该原品牌字样的赛车、白跑车和城堡图片。
- 原站内容替换为 MigosAI、Nano Banana 2、Hotel Lobby、Flying Car、Özil Goal、AI Rap Song；所有按钮通往已有功能、工具、作品、价格或法律页面，无虚构 API、客户标识或评价。
- 轮播每六秒自动切换，支持前后、暂停/恢复和轮播区域左右键；页面隐藏、菜单/弹窗打开、减少动态效果偏好或轮播中有键盘焦点时停止自动切换。
- 移动菜单支持展开/收起、外部点击、Escape 关闭和归还焦点。
- 视频预览使用现有真实视频与 Radix Dialog，含播放控件、Escape/遮罩关闭；作品预览支持前后按钮与左右键切图，关闭归还对应入口焦点。媒体在弹窗关闭时卸载。
- FAQ 使用原生 details/summary，支持键盘操作；导航 FAQ 锚点有效。
- 使用已有五语字典和语言切换器；新增文案表和 FAQ 的翻译覆盖由回归测试验证。Geist 字体从本地加载，随资源保留 OFL 文件。

## 本次验证

- 实现前：`npx vitest run components/landing/landing-page.test.tsx` 确认 6 项中 1 项失败，原因是新测试要求的 FAQ/视频/暂停功能尚未接入。
- 实现后：`npx vitest run components/landing/landing-page.test.tsx tests/portal-navigation.test.tsx`，26 项通过；涵盖功能链接、真实资源存在与接入、12 个作品预览入口、6 个 FAQ、五语文案和门户回归。
- `npm run typecheck` 通过。
- Chrome 在独立 3011 开发服务验证：轮播 Next 切到 2/3，暂停按钮状态改变；视频弹窗显示真实播放器与创作入口；作品下一张切至第二张与 2/12；FAQ 展示完整点数说明。
- 390×844 实机浏览器视口验证：菜单可展开、Escape 收起，页面 `clientWidth` 与 `scrollWidth` 同为 390，无横向溢出；截图检查首屏文字、视频入口和控制按钮布局。
- 截图证据：`docs/ideogram-clone/RECON/screenshots/clone-desktop.jpg`、`clone-mobile-390.jpg`、`clone-full.jpg`。
- 未运行生产构建、未提交、未部署；生产构建及集成验证由发布主任务执行。

## 对照范围

保留参考站的布局节奏与颜色层次，内容按已存在的 MigosAI 产品数据替换。没有宣称像素级一致；原参考全页截图包含懒加载留白，本实现使用已保存作品图片填充。原站资产来源记录在现有 `asset-manifest.json`；本文件不新增素材使用许可声明。
