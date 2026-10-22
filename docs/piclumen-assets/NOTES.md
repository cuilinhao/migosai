# PicLumen Assets 原站源码核对

日期：2026-10-22。目标：将 MigosAI `/app/assets` 的视觉和作品管理交互按 PicLumen Assets 重建，保留 MigosAI 自有用户数据、鉴权和生成接口。

## 来源和证据边界

原站导航中的真实入口为 `https://www.piclumen.com/user/assets/`。未登录浏览器进入该入口会回到首页并展示登录弹窗。随后用户自行在 Chrome 的 linhao 配置中完成登录，主任务通过该浏览器查看了真实 Assets 页面，桌面截图保存在 `.local-evidence/piclumen-assets/original-desktop.png`（1512×862），确认了下面公开源码中的主要结构和尺寸。本次没有绕过登录或伪造登录态。以下条目为 **SOURCE（公开部署源码）** 证据；实现和本地浏览器验收见文末。

没有找到可复用的官方开源工程。沿此前取得的 Nuxt 路由文件 `Bw0xbdnV.js` 中 `user-assets___en` 的组件及 `__vite__mapDeps` 引用，下载公开 JavaScript/CSS。当前部署根目录为 `https://statics.piclumen.com/app-1792654482667/_nuxt/`。证据保存在忽略目录 `.local-evidence/piclumen-assets/source/`；`manifest.json` 保存资源地址、大小和 SHA256。

原始文件不修改；`*.readable.js` 仅按分号及 `},` 换行便于定位，以下行号指这些可读文件。没有执行原站脚本，也没有把原站运行时纳入应用。

## 桌面结构（SOURCE）

来源：`DFepAOAL.readable.js`。

| 位置 | 核实内容 |
| --- | --- |
| 257–274 | 二级收藏面板：外层视口高度、上下16px留白；宽260px，圆角24px，边框1px；顶部8px，左右16px，底部16px内边距。底部 Storage 卡片12px圆角、12px内边距、4px进度条。 |
| 282–303 | 顶部 `Creation` / `Uploaded` 两个页签。默认 Creation，未归类ID为−1。Uploaded读取上传文件夹并选择首个文件夹。 |
| 348–365 | 页签底部24px间距；`Unsorted` 36px行、计数徽标，底部24px间距；`Collections` 36px标题行和新增按钮；文件夹行36px高、8px圆角，支持重命名、移动、导入和删除。 |
| 366–374 | 页面为视口高度；二级面板与画廊间距16px。主区单独滚动，不含营销标题或页脚。工具条 sticky top0，padding16px。 |
| 381–398 | 媒体只有 Image / Video / Audio，默认Image；排序默认Descending；默认Square布局、Medium尺寸。原站没有All assets选项。切换媒体或文件夹会重置分页、选中项和滚动位置。 |
| 437–441 | 网格列数依据主区内容宽度减16px计算：≤480为2，≤768为3，≤1144为4，≤1440为6，≤1660为8，更宽为10；Small乘2，Large除1.3，向下取整且至少2列。 |
| 578–617 | 工具条右对齐：排序、布局、账号组件，间距16px；排序/布局按钮40px高、8px内边距、8px圆角，图标20px。媒体分类在第二行，顶部8px间距，36px高、18px圆角，最小64px、左右12px，14px/22px、500字重。 |
| 618–636 | 网格按创建日期分组；日期头44px高，画廊左右16px；选择后底部显示64px高浮动操作条，支持收藏/移动、下载、删除。点击文件进入统一预览组件。 |

页签细节：`DmB0J9uQ.js` 和 `index.DrrRu-v6.css` 中的 `diff` 类型为下划线页签，不是胶囊按钮。Creation / Uploaded 两项各占一半宽度、24px间距、14px字600重、8px内边距，底部细线；选中指示条3px高、紫色、4px圆角。

网格细节：`DFepAOAL.readable.js` 98–109 的默认 gap为4px，Square单元格；`assets.1Ir3r-Ie.css` 的日期头14px、500字重、左右16px内边距，缩略图4px圆角。Full模式仍是方形单元格但用 `object-contain` 保持媒体完整比例；Square用 `object-cover` 方形裁切（216–219行）。卡片不是带长文本、价格和日期的传统内容卡片。

## 真实英文文案与空状态（SOURCE）

`Bw0xbdnV.js` 的英文语言加载器指向 `Crfp6nfu.js`，已下载并提取到 `labels.json`。

- 排序：`Descending` / `Ascending`。
- 布局：`Full` / `Square`；尺寸：`Small` / `Medium` / `Large`。
- 侧栏：`Creation`、`Uploaded`、`Unsorted`、`Collections`、`Storage`。
- 原生成记录空文案：`You have not created any images temporarily, go create some now!`。按钮：`Create`，跳到图像生成。
- 原上传空文案：`You haven't uploaded any files yet. Go upload some now!`。按钮：`Import File`。
- `Bp5qV5AX.readable.js` 5–31：空状态在画廊区域居中，深色插图128px正方形，文字上边距16px，按钮上边距32px、最小宽120px。
- 深色插图是页面直接引用的 `https://statics.piclumen.com/pic-static/images/notice_empty.webp`，已下载为证据目录中的 `notice_empty.webp`（11,492字节）；没有用近似重绘替代。

原站未归类记录在免费账户会出现30天自动清理提示（`DFepAOAL.readable.js` 615–617）。这属于原站商业与存储规则，不能直接写成 MigosAI 的服务承诺，接入时应按 MigosAI 实际规则处理。

## 色彩（SOURCE）

原页 HTML 的内联全局 CSS 已提取为 `inline-styles.readable.css`：深色二级面板 `--p-fill-ww-10:#ffffff0d`，边框 `--p-border-2:#ffffff1a`；工具按钮 `--p-bg-2:#121216`；文字 `--p-text-2:#c2c1c3`、弱文字 `--p-text-4:#6d6b75`；选中行 `--p-fill-opt-t-3:hsla(0,0%,100%,.1)`；类别选中背景白10%、未选中白5%；存储进度 `#7b57e5`。

## 移动端（SOURCE）

桌面 CollectionPanel 没有自身的媒体查询或隐藏条件。Nuxt 路由和通用路径转换函数将移动端作品集入口转换到 `/m/collection/`，对应 `CqrRv13N.js`；单个作品集为 `/m/collection/:id/`，对应 `DzA3lx2c.js`。

`CqrRv13N.readable.js` 展示独立移动界面：两列文件夹卡片，8px间距；上方新增文件夹和存储图标；每个文件夹方形封面、文件夹名与计数；存储详情从底部弹出。MigosAI 若保留 `/app/assets` 单一路径，应记录其移动适配差异，不能把桌面面板直接缩到手机宽度并宣称原站逐像素一致。

## 本次记录范围

本文件记录原站公开源码、登录后浏览器对照和本地实现验收。参考资源未核实为开放授权；本次资料用于用户要求的本地复刻，保留来源，不表示已公开部署或取得原站私有功能授权。


## 实现与产品适配

- `/app/assets` 使用与首页一致的 PortalShell，移除旧账户中心导航及营销页脚；账户订单、积分等路由保留各自功能。
- 桌面双侧栏、260px 收藏面板、下划线 Creation / Uploaded、Image / Video / Audio、排序、布局与尺寸菜单、日期分组网格和空状态按上述源码及登录页对照完成。保留 MigosAI 品牌与现有导航取舍。
- 收藏夹创建、重命名、删除、作品移动、拖拽归类、批量选择、预览、下载和软移除/撤销均连接 MigosAI 真实数据。原生成记录的多输出、视频/音频播放、任务进度、错误与恢复入口保留。
- 上传复用 `/api/uploads`，目前支持 JPEG / PNG / WebP，单张最大 10 MB，一次最多 10 张。Uploaded 代表本人上传记录，不用原站用户内容或演示卡片填充。
- 新增 `/api/asset-library`、收藏夹及归类元数据表。写操作验证同源、登录、文件所有权、收藏夹所有权及来源；批量操作先全部验证再原子写入。软移除不删除原始生成任务和媒体；删除收藏夹将文件返回未归类区。
- 生成和上传历史沿用现有最近 100 条查询规模；Storage 显示真实上传文件数。MigosAI 未配置原站存储配额或30天自动清理规则，因此不照抄这些商业承诺。
- 手机保留 `/app/assets` 单一路径，以收藏夹抽屉配合媒体网格适配；与原站 `/m/collection/` 的两列文件夹首页不同。桌面结构以原页为准，移动端明确采用本项目适配方案。
- 非英文界面补齐现有五种语言的资产库文案。视图偏好按用户隔离保存在本地，作品和归类数据仍由鉴权接口读取。

## 验证

- `npm run typecheck` 通过。
- `npm test -- --exclude components/landing/landing-page.test.tsx`：90 个文件、1509 项测试通过。排除项属于并行进行中的 landing 改动，本次没有修改该文件。
- `npx opennextjs-cloudflare build --dangerouslyUseUnsupportedNextVersion` 完成。沿用项目当前 Next 版本，未升级依赖。
- `0008_asset_library.sql` 已在本地预览 D1 执行；未执行线上迁移、部署或付费生成。
- 独立本地测试账号实测：登录、创建生成收藏夹、上传仓库内测试图、预览、创建上传收藏夹、移动并刷新核对持久化、移除和 Undo 恢复。API 返回与界面数量一致。
- 本地视口检查覆盖 1440×1000、768×1024、390×844；手机抽屉及分类切换可用，没有横向溢出。平板复检发现账户区预留不足，按登录状态增加预留空间，并重新构建验证。
- 截图证据位于忽略目录 `.local-evidence/piclumen-assets/`，包括 `local-1440.png`、`local-768.png`、`local-390.png` 和 `local-390-uploaded.png`。测试账号凭据不进入版本控制。
