# 两种趋势模板的后端契约

更新日期：2026-11-06。

## 请求和固定参数

`POST /api/trend-video/generations` 使用本站账户或游客钱包会话、同源检查和 `Idempotency-Key`。请求体只接受 `effectId`、可选 `variant`、已上传的私有 `photo` 键以及 `consent: true`。任何其他字段均返回400，不接受客户端模型、报价、提示词、参考视频URL或工作流版本。

| effectId | variant |
| --- | --- |
| goodbye-2026-welcome-2027 | fur-collar（默认）、everyone-up、arms-wide、snow-climb、final-seven |
| stones-to-castle-ai | default（默认） |

公共配置位于 `lib/trend-video.ts`：Kie Seedance 2.5、10秒、480p、9:16、静音；报价来自 `getFlyingCarCost(10)`，目前为75站内积分。该报价不是供应商美元成本或供应商积分换算。创作提示词留在 `lib/server/trend-video.ts`，按照公开视频观察独立编写，不宣称获得参考站私有模板。

新年五种变体均使用一张人物照片。Everyone up 是同一人物的双画面蒙太奇；Arms wide 开场已经站在数字上，以展臂和轻环绕拉远为主；Final seven 把站在最后一个7上作为本站创作目标，参考实际成片未能证明始终准确实现该目标。城堡使用地面石堆自动堆叠成原地微缩城堡，无人物、手或投掷。

## 保留既有生成链路

持久化 payload 使用 `template: 'flyingcar'`，附加 `trendEffect`、`trendVariant`、`workflowVersion: 'trend-video-v1'`，以及冻结的完整提示词和模型参数。任务直接复用 `advanceJob` 的 FlyingCar 分支和 `createKieFlyingCarVideo`，无需增加付费阶段。

照片复用 FlyingCar 的所有权、数据库元信息、私有R2对象、ETag、字节数、实际图片尺寸和格式检查。新预约前检查供应商、签名、存储及审核配置。已存在的显式请求键先按账户和公开选项匹配并恢复，再检查当前素材或服务配置；提示词、工作流版本和价格更新不会覆盖原预约。并发INSERT后的二次匹配使用相同规则。效果、变体、照片或许可变化会拒绝复用旧键。

提交、租约、供应商句柄、不确定提交人工核对、查询重试、失败退款、最终文件私有存储和审核保持现有行为。响应仅增加公开 `trendEffect` 和 `trendVariant`，不泄露照片键或提示词。`getResumableVideo(history, 'flyingcar', effectId)` 按效果恢复；未传效果的旧FlyingCar入口排除趋势模板任务。完成结果仍进入本站历史和授权下载。

## 官方参数核对

2026-11-06读取 [Kie Seedance 2.5官方接口文档](https://docs.kie.ai/market/bytedance/seedance-2-5)及该页面公开schema：模型ID为 `bytedance/seedance-2-5`；时长支持4–30秒；分辨率包含480p、720p、1080p；支持 `reference_image_urls`、`aspect_ratio`、`generate_audio` 和 `nsfw_checker`。参考图支持JPEG/PNG/WebP，宽高比严格大于0.4且小于2.5，两边均严格大于300且小于6000像素；本站继续使用更严格的10MB文件限制。

同一公开schema的 `prompt.maxLength` 为20480。新接口不经过FlyingCar通用编辑器和自由提示词端点的600字符限制；专项测试确认超过600字符的模板完整冻结到数据库，并由正式adapter逐字直传给Kie。

参考图模式与严格首帧/首尾帧模式互斥。本实现使用参考图模式，不保证用户照片逐像素成为第一帧。静音、480p、10秒是本站模板设置，并非宣称模型只能提供这些规格。不使用新供应商、Seedance Mini、首尾帧或参考视频字段。官方文档支持查询任务详情；本站保留现有持久化轮询。

## 验证证据及边界

实现前运行新增测试：37个用例失败，包括缺失新接口、跨版本预约409以及缺失公开效果元信息。实现后新增用例扩展至43个，覆盖五变体、地面城堡输入、参数注入、许可、账户隔离、游客钱包、固定计费、显式/隐式幂等、跨版本恢复、并发胜出预约、坏JSON/请求键、缺配置、共享历史和正式adapter请求。

最终后端专项命令：

```sh
npx vitest run tests/trend-video-generations.test.ts tests/flyingcar-generations.test.ts tests/flyingcar-jobs.test.ts tests/gangnam-style-billing.test.ts tests/generation-history-route.test.ts components/generator/generation-history.test.ts tests/moderation-jobs.test.ts tests/kie-jobs.test.ts tests/provider-policy-failure.test.ts tests/flyingcar-image-validation.test.ts
```

结果：10个测试文件、202个测试通过。包括共享审核、供应商状态、失败退款与不确定提交路径的回归。测试使用本地SQLite和受控供应商响应，不调用付费生成。全量测试、typecheck、构建由主任务在页面整合后运行并记录。没有真实成片、付费生成、生产发布证据；数字精确性、人物连续性、双画面和石块组装效果仍需授权后的真实视频验证。
