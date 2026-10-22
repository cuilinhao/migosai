# MigosAI /landing 实现记录

- 根据 Recraft 真实 Framer HTML（本地读取约 1 MB）及根代理保存的参考截图复刻视觉结构；未加载原站脚本、商用字体或服务。
- 八个主体 section：三页主视觉轮播、现有模型与工具标识带、图片能力大图、横向摄影画廊、粉色拼贴、真实视频工具、音乐能力、最终 CTA；另有完整导航与四列页脚。
- 保持黑色背景与 64px 导航、紫色公告、lime 按钮、蓝色模特主图、超粗标题及大图间隔。字体仅使用已安装的 Anton / Archivo Black，非商用字体复本。
- 内容仅对应已接入的 Nano Banana 2、Hotel Lobby、Flying Car、Özil Goal、AI Rap Song。图片价格为 1K/5、2K/8、4K/12 站内点数，不虚构客户、评价、vector 功能或 API 产品。
- 主轮播支持上一页、下一页、三个圆点、左右键和 aria-live 状态。摄影画廊有真实横向滚动按钮、键盘可聚焦区域及移动端滑动；减少动态效果偏好受支持。
- 手机导航支持展开/收起、Escape 关闭后归还焦点、点击外部关闭、选中链接后关闭。跳过导航链接和可见焦点轮廓均保留。
- 106 条翻译词条覆盖五个非英文语言；101 个页面使用的文案/图片说明全部有对应翻译。metadata 使用 localizeMetadata；中央语言注册、路由、外壳由根代理整合。
- 原图来源和本地学习使用边界见根代理维护的 `docs/website-clone/NOTES.md` 和资源清单；产品页面不显示开发验收说明。

## 验证

- `npx vitest run components/landing/landing-page.test.tsx`：6 项通过，真实 React 渲染验证功能目的地、点数、八区结构、轮播控件及五语翻译。
- 联合迁移测试：`npx vitest run components/landing/landing-page.test.tsx tests/hotel-lobby-migration.test.tsx`，19 项通过。
- 最终完整 `npm test`：75 个文件、1245 项全部通过；`npm run typecheck` 通过；`git diff --check` 无错误。
- 词条与本地资源核验：106 条记录每条均有完整五语译文；101 个页面使用词条无遗漏；全部引用的 reference 文件存在。
- Chrome 实际 390 宽首屏无横向溢出，导航展开与 Escape 收起、Next 按钮、第三圆点、ArrowRight 循环回首屏均验证成功；768 宽两栏布局已观察。原始默认桌面宽度首屏也已对照参考图。
- 根代理随后停止开发服务器以运行生产构建；完整 1440/768/390 最终截图和后续懒加载图片验收由根代理在统一生产预览中完成。已恢复浏览器 viewport 默认值，没有新起/停止服务。
- 没有提交、部署、真实生成或付费请求。
