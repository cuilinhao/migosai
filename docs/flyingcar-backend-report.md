# FlyingCar 生成接入记录

## 已实现的行为

- `POST /api/flyingcar/generations` 接收 `{ prompt, duration, photo?, consent? }`，先执行既有同源检查和登录鉴权。prompt 按原站规则去除首尾空白后要求 12–600 字符，保留内部换行和用户内容，不附加未经获取的原站隐藏提示词。
- 时长为 5–30 的整数。服务端固定 Kie 的 `bytedance/seedance-2-5`、480p、9:16、`generate_audio: false` 与 `nsfw_checker: true`。客户端提交的供应商、模型、成本、画幅、分辨率、声音和模板参考字段不进入预约。
- 无图请求不查询或上传图片。有图请求要求 `consent === true`，沿用原有上传 key 结构，并独立验证当前用户归属、JPEG/PNG/WebP MIME、非音视频参考素材、真实 R2 对象、非空、10 MiB 上限及 MIME 一致性。供应商收到一条签名私有图片 URL；不携带 Ozil 或酒店模板视频、音频。
- 图片尺寸在预约与扣积分前验证：按已授权 R2 对象的 ETag 读取真实二进制，使用纯 TypeScript 解析 JPEG、PNG、WebP 的尺寸头，并校验对象未替换、实际字节数和 MIME。每边必须为 301–5,999 像素，宽高比严格大于 0.4 且小于 2.5；客户端提供的宽高不能替代此检查。不合格尺寸、损坏图片头、MIME 不符及对象读取前后不一致均返回 400，不创建任务或扣积分。客户端也对最终预处理文件使用同一尺寸规则提前提示。
- generation 仍为 `video`，以 `template: 'flyingcar'` 区分。原有 `reserveGeneration`、余额扣除触发器、积分账本、幂等键与退款机制不变。相同请求重试返回原预约，复用同键修改 prompt、时长或图片返回 409；已预约任务可在供应商临时缺配置时恢复。
- `advanceJob` 新增 FlyingCar 的首次提交分支；后续继续使用 Kie 任务查询、租约、私有结果下载、SeeAPI 审核和私有交付。网络不确定的付费提交进入人工核对，不重复提交；明确失败和审核阻断通过原账本只退款一次。
- 历史接口仅公开 `template` 标识，不公开 prompt 和上传 key。FlyingCar、Ozil 和酒店生成器只恢复各自尚未完成的任务。
- Kie 2.5 模型映射仅用于 FlyingCar，新模型未加入通用酒店生成器的模型选项。原有 Ozil Fal/Kie 参数、支付套餐、数据库 schema、密钥和部署配置不变。

## 价格

页面和服务端共同使用 `getFlyingCarCost`，单位为 migosai 共享积分：

- 5–15 秒直接调用既有 `getVideoCost(duration, '480p', 'seedance-2')`。
- 16–30 秒继续既有最终价格段：`getVideoCost(15, '480p', 'seedance-2') + (duration - 15) * 15`。
- 样例：5 秒 50，10 秒 75，15 秒 150，20 秒 225，25 秒 300，30 秒 375 积分。

这是本次确认的站内报价规则，不是将 Kie 上游积分当作 migosai 积分。原有一次性积分套餐与购买入口没有改变。

## 官方接口依据

2026-10-17 只读核验：

- [Kie Seedance 2.5 官方接口文档](https://docs.kie.ai/market/bytedance/seedance-2-5.md) 公开同一 `/api/v1/jobs/createTask` 接口、`bytedance/seedance-2-5` 模型、4–30 秒时长、480p、9:16、可选图片参考和声音开关；任务详情继续使用既有统一查询接口。
- 同一文档的 `reference_image_urls` 对图片宽高使用 `(300,6000)`、宽高比使用 `(0.4,2.5)`，均为开区间。实现因此拒绝恰好 300 或 6,000 像素以及恰好 0.4 或 2.5 的边界值。
- [Kie Seedance 2.0 官方接口文档](https://docs.kie.ai/market/bytedance/seedance-2.md) 的时长仍为 4–15 秒，因此没有直接把现有 2.0 请求扩大到 30 秒。
- [Fal H3 text-to-video 官方 schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=minimax/h3/text-to-video) 的 maximum 为 15；H3 image-to-video 和 reference-to-video 同样不覆盖原站的完整 30 秒范围。FlyingCar 因此不复用 Ozil 的 H3 提交函数。

原站业务长度规则来自本仓库 `content/flyingcar-interactions.json` 的公开源码导入。供应商允许更长文本不代表本页面开放更长提示词。

## 验证与边界

- 后端定向验证：`tests/flyingcar-generations.test.ts` 68 项、`tests/flyingcar-jobs.test.ts` 8 项、`tests/flyingcar-image-validation.test.ts` 26 项及 `tests/flyingcar-photo-dimensions.test.ts` 20 项，共 4 个文件、122 项测试通过；`git diff --check` 通过。
- 覆盖文本与可选图片、30 秒、价格边界、越界时长、图片归属和存储验证、同意、客户端覆盖、相同与冲突幂等、余额不足、鉴权、服务配置、历史隔离、单次付费提交、并发租约、明确失败退款以及审核通过/阻断后的私有交付。
- 图片测试读取仓库中的真实二进制 fixture，覆盖基线与渐进 JPEG、PNG、VP8/VP8L/VP8X WebP，以及最小/最大尺寸和宽高比的开区间边界、损坏或截断的头部、MIME 不符和 ETag 替换。解析器校验尺寸头及容器结构，不执行像素解压；运行时不新增原生图片依赖。
- 最终全量测试、类型检查和构建结果统一见[验收记录](./flyingcar-verification.md)。
- 所有上游网络与 R2 结果均为受控测试替身，余额/账本使用真实迁移建立的内存 SQLite。未发起真实付费生成、付款、远程数据库操作、部署或 Git 提交；模拟成功不证明模型实际画面效果、30 秒成片时长或静音成片质量。
