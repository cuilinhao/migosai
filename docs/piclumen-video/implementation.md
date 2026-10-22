# 视频工作台复刻记录

2026-10-22：按用户确认，将 `/ai-video-generator` 从效果卡片入口改为 PicLumen `/ai-video/` 对应的创作工作台。用户明确选择复用现有 Seedance 2.5 接口。

## 结构与视觉

- 桌面三栏：沿用 MigosAI 导航；376px 参数面板；右侧四列视频灵感区。参数面板固定在视口内，生成按钮固定在面板底部，字段可独立滚动。
- 1440px 实测目标：导航 x16/w200；参数面板 x232/w376；灵感区 x624/w800。面板 24px 圆角、16px 内边距；输入控件为深灰，生成按钮为 #7b57e5、44px 高、8px 圆角。
- 平板使用图标导航、顶部提示词、两列视频；手机使用顶部提示词、底部导航与参数抽屉。保持 MigosAI 品牌、既定导航删减及 Quests Coming soon。
- 模型弹层保留原站的分类与选项结构，只展示可用 Seedance 2.5；Hotel Lobby、Flying Car、Ozil 的原有完整工具仍可从模板分类进入。
- 原站素材和来源见 [reference.md](./reference.md)。没有复制原站私有运行时或业务接口。

## 实际生成能力

复用 `/api/flyingcar/generations` 和原有上传/计费/历史服务，提交用户原始提示词。模型仍为 Kie Seedance 2.5，提示词12–600字符，一张可选参考图，5–30秒、9:16、480p、静音。10秒75积分，15秒150积分，其他时长由原有 `getFlyingCarCost` 统一计算。

其他画幅和自动翻译显示不可用状态与说明，不会提交无效参数。已有任务继续显示进度、结果和下载；失败响应重试复用请求标识；匿名草稿登录后保留，账号切换立即隐藏并清理私人输入、上传、任务和轮询。

## 验证

- `npm run typecheck` 通过。
- `npm test -- --exclude components/landing/landing-page.test.tsx`：87个文件、1456项通过。排除项是另一个正在进行的 landing 改动；本次没有修改或提交它。
- 新增9个异步行为测试，覆盖防重复、同请求重试、历史恢复、轮询及账号隔离；另有6种语言的工作台渲染验证。
- `npx opennextjs-cloudflare build --dangerouslyUseUnsupportedNextVersion` 完整通过。当前项目 Next 15.5.27 触发 OpenNext 的既有版本日期限制，本地验证使用兼容参数，没有升级依赖。
- 6种语言的视频页、首页、Hotel Lobby 原内页、图片页及示例媒体均 HTTP200。
- 浏览器实际检查：1440×1000、768×1000、390×844；无横向溢出；控制台无错误。
- 浏览器交互检查：时长切换同步扣点；匿名生成打开登录且保留提示词；模型弹层与手机参数抽屉；视频播放与套用提示词；参考图预览/移除/错误类型校验；手机导航与所有弹层的焦点恢复。
- 验证没有调用付费 Kie 生成。计费与生成生命周期使用既有后端及模拟网络的行为测试验证。

截图和日志位于忽略目录 `.local-evidence/piclumen-video/`：`original-1440.png`、`original-768.png`、`original-390.png`，以及 `local-1440.png`、`local-768.png`、`local-390.png`、`local-model-picker-1440.png`。
