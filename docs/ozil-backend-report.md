# Ozil Goal Generator 后端实施报告

## 首阶段：Seedance 实现记录

以下为首阶段实现及当时验证结果。当前新任务默认供应商已按用户后续授权切为 Fal MiniMax H3，详见后续章节；旧 Kie 任务继续保留原供应商和参数。

- `POST /api/ozil-goal/generations` 接收 `{ photo, consent }`，沿用同源检查、登录会话和 API 错误格式；要求 `consent === true`。
- 图片 key 必须位于当前用户的 `users/<id>/uploads/` 路径，且 uploads 表中归当前用户所有，类型为 JPEG、PNG 或 WebP、非音视频参考文件。再查询真实 R2 对象，要求存在、非空、不超过 10 MiB，并且存储 MIME 与上传记录一致。图片文件头由现有上传接口验证。
- 共享配置 `lib/ozil-goal.ts` 固定 Seedance 2.0、15 秒、9:16、720p、15 秒参考视频 `/templates/ozil-goal/motion.mp4`。`OZIL_GOAL_COST` 调用现有 `getVideoCost(15, '720p', 'seedance-2', 15)` 得出 **300 积分**，供前端展示和后端扣费共同使用。
- 请求只提取 photo 和 affirmative consent；客户端传来的 model、provider、cost、resolution、duration、aspect、reference URL、prompt 和 audio 开关不会影响保留记录或供应商请求。
- generation 仍为 `video` 类型，payload 保存 `template: 'ozil-goal'`、`provider: 'kie'`、photo、consent 和固定模板参数。复用 `reserveGeneration`、积分账本和幂等键，余额不足不创建任务；相同请求返回原任务，改变图片复用同一键返回 409。
- 新增 `createKieOzilGoalVideo` 使用已有 Kie request 实现，只提交一张签名私有图片、一条本站固定 motion 视频、独立足球提示词及有声生成开关，不提交酒店音轨。提示词约束身份和原衣服鞋、参考视频的镜头和其他球员、三段动作、足球连续运动与禁用说唱。
- `advanceJob` 根据模板分流首次提交，随后继续共用原 Kie polling、任务租约、失败退款、结果隔离、SeeAPI 审核和私有结果返回。旧双图 Kie、APIMart 和音乐分支保留。超时等不确定提交仍进入人工核对，避免重复付费请求。

## 验证

- 实现前添加 `tests/ozil-jobs.test.ts`，真实 RED 结果为固定足球动作参考断言失败：旧流水线实际提交了 `/templates/hotel-lobby/motion-15.mp4`。独立模板分流实现后该测试通过。
- 添加 `tests/ozil-generations.test.ts` 32 项 API 测试，覆盖无效同意、非法 key、他人上传、数据库归属、存储对象不存在/错误类型/尺寸、固定成本与客户端覆盖、显式及缺省幂等、余额不足、认证与同源、服务配置、无效 JSON 和 Seedance 停机策略。
- 额外暂时移除 consent 校验执行回归验证：5 项无效 consent 测试均以“实际 202、预期 400”失败；恢复校验后全部通过。此变异未保留在源码。
- Ozil jobs 测试覆盖单图签名及固定视频载荷、后续 GET 轮询、一次失败退款、不确定 POST 不重试、结果在审核前不可读。
- `npm test -- tests/ozil-generations.test.ts tests/ozil-jobs.test.ts tests/kie-jobs.test.ts tests/kie.test.ts tests/moderation-jobs.test.ts tests/video-reference-generation.test.ts`：6 个文件、159 项通过。
- `npm run typecheck`：通过。
- `npm test`：最终检查 48 个文件、815 项通过，包括既有双图、计费和审核测试（检查时并行前端实施已纳入）。
- `git diff --check`：通过。

## 范围与限制

- 本子任务未调用真实 Kie 或 SeeAPI 服务、未生成付费视频，测试中的上游响应为受控模拟；真实画面效果和模型对动作参考的遵从程度仍需实际生成验收。
- 固定 motion 素材由素材子任务负责制作和保存；本子任务验证发送的本站路径和参数。
- 历史响应的 template 标记及前端分别恢复相应模板任务由父任务负责整合。
- 未提交 Git、未部署；未读取或输出真实 secret。

## 第二阶段：Fal MiniMax H3 接入

### 当前行为

- 新 Ozil 任务由服务端固定为 `provider: 'fal'`、`model: 'minimax-h3'`、`endpoint: 'minimax/h3/reference-to-video'`、15 秒、9:16、768p；模板成本固定为 **300 积分**，前后端继续共享 `OZIL_GOAL_COST`。Fal 原生请求中的分辨率值为 `768P`。
- `KIE_OZIL_GOAL_CONFIG` 和原 Kie 提交函数保留。持久化 payload 使用明确的 Fal/Kie 类型联合，`advanceJob` 根据已保存的 provider 分流，已有 Kie 任务不会因为新默认配置而迁移或重新提交。旧双图视频与音乐流程保持原分支。
- 单照片归属、真实 R2 对象、类型、尺寸和 consent 验证不变。客户端仍不能覆盖供应商、模型、价格、参考媒体或提示词。Fal 只收到一张私有签名照片与本站固定 motion 视频，提示词通过 `Image 1` / `Video 1` 引用，保留三段动作、身份、服装、镜头和音频氛围要求。
- Fal 使用原生 Queue REST，无 SDK 自动重试；提交包含 `Authorization: Key` 和 `X-Fal-No-Retry: 1`，30 秒超时。POST 的网络、超时、5xx 或不可信响应均按不确定提交处理，保留人工核对状态，不自动重复付费提交。
- 将校验后的队列句柄保存至 `provider_id`，包含 request ID 以及状态/结果 URL。URL 必须精确属于 `queue.fal.run` 的 MiniMax H3 已知路由，并匹配同一 request ID；再次轮询时重新验证。客户端 URL、异源 URL、其他模型路由和不匹配 ID 均不能用于带凭证请求。
- `IN_QUEUE` / `IN_PROGRESS` 继续轮询；查询网络错误、服务错误和重定向作为临时查询错误，只重试查询。完成后的明确失败沿用一次退款；异常错误结构按不确定处理。`COMPLETED` 不直接等同于成功，状态和结果中的错误字段都检查后才接受视频。
- Fal 视频结果必须为 HTTPS 且属于 `FAL_MEDIA_HOSTS` 的精确主机白名单。首次下载不转发 Fal 凭证，不跟随重定向，继续使用原有类型/尺寸检查、私有 R2 隔离、SeeAPI 审核、任务租约及结果接口。新增配置项为 `FAL_KEY` 和 `FAL_MEDIA_HOSTS`；当前允许的 CDN 主机由主任务配置。
- Ozil 幂等匹配只比较 template、photo 和已确认的 consent，已有记录的 payload、provider、成本及 ledger 原样保留。显式幂等键跨切换可恢复旧 Kie 任务；同分钟的旧默认幂等键也兼容恢复。即使新 Fal 临时缺配置，已存在的旧预约仍可返回；新预约仍会被配置检查阻止。这些路径都不会再扣一次 300 积分。

### 第二阶段测试与交接证据

- 新增 `tests/ozil-fal-jobs.test.ts` 的 9 项集成测试，并先验证 RED：切换前没有 Fal 提交路由、句柄或配置，相关断言失败。实现后覆盖请求 schema、单图和固定视频、持久化队列句柄、后续仅 GET、临时查询失败、明确失败只退款一次、不确定提交不重试、不可信句柄、审核前隔离以及并发 worker 只提交一次。
- `tests/ozil-generations.test.ts` 现有 34 项测试，包括默认 Fal 参数、服务端固定 300 积分、客户端覆盖无效、Seedance 停机开关不影响 Fal，以及显式/默认幂等键在 Kie → Fal 切换后恢复旧任务且不重复扣费。跨切换测试也先观察到原实现的 503 失败，再实现兼容。
- `tests/ozil-jobs.test.ts` 保留 4 项旧 Kie Ozil 流水线回归，继续验证旧供应商参数和共享处理链。
- 2026-10-15 14:46 完整 `npm test`：**52 个文件、855 项通过**；同阶段 `npm run typecheck` 与 `git diff --check` 通过。此结果包含并行前端变更，发生在独立 Fal 客户端审查最终小修之前。
- 独立审查子任务随后补齐 `tests/fal.test.ts` 的 60 项测试，修正 30 秒超时、查询重定向分类、错误字段形状检查和媒体 URL 空白拒绝。审查子任务报告 `tests/fal.test.ts` + `tests/ozil-fal-jobs.test.ts` **69 项通过**，`npm run typecheck` 通过，并于 14:48 锁定客户端。
- 主任务在客户端锁定后确认最终完整 `npm test`：**53 个文件、915 项全部通过**，Cloudflare 构建成功，浏览器构建产物的 Fal key 扫描结果为 0；独立最终代码审查未发现问题。
- 所有运行代码现已锁定；真实 Fal QA 正由主任务执行，画面和账本结果以主任务验收记录为准。本子任务没有发起付费调用、修改远端、读取密钥、部署或提交 Git。

### 真实 QA 边界

- 主任务已确认首阶段真实 Kie QA 任务 `196af288-5688-43fb-b329-76a4840f8906` 完成且审核通过，保留其原始单笔 `-300` 账本和 provider；该任务不取消、不迁移、不与 Fal 测试混记。
- 新 Fal QA 使用独立测试账号与独立请求，按主任务计划验证诊断余额 600 → 300、完整生成/审核/下载流程及画面效果。真实 Fal 结果仍须主任务实际验收，单元测试不能证明模型画面质量。

## 2026-10-15 真实验收

- 按用户授权，测试图片使用本机 Downloads/tom.png，通过公开 HTTPS 隔离版本的标准注册、上传、Ozil 生成、轮询、SeeAPI 审核与私有下载接口完成；测试 D1 与生产 D1 隔离，未修改正式客户余额。
- Seedance 2.0 对照任务完成并审核通过，输出 720×1280 / 24fps / 15.072s / AAC，有效音轨；保存于 Downloads/ozil-goal-tom-seedance2-test.mp4。
- 用户随后授权 fal.ai MiniMax H3。独立 H3 测试账号初始 600 积分；初次提交、同键重复提交、完成后重复提交均返回同一个任务，最终余额 300，账本仅一条 amount=-300 的生成扣款。任务状态 completed，审核 verdict=passed，结果 ETag 已核对。
- H3 供应商记录的 inference_time 为 67.624 秒。实际输出为 H.264 / 768×1344 / 24fps / 15.104s，AAC 音轨平均 -19dB、峰值 -5dB，非静音；保存于 Downloads/ozil-goal-tom-minimax-h3-test.mp4。
- 主任务与独立审查者检查全片采样和密集动作帧，三段动作可辨，灰短发、黑框眼镜与深色西装连贯，无采样可见的明显多肢、融合身体或人物造型错换。实际局限为约 4.5 秒跳接、滑铲约 6.5 秒发生、约 10–11 秒主角短暂出画；不是逐帧或精确时间轴复制。
- 最终验证：53 个测试文件、915 项测试通过；类型检查与 Cloudflare 构建成功；浏览器静态资源中私有 FAL_KEY 扫描命中为 0。
- 运行证据、测试账号与私有密钥仅保存在 Git 忽略的 .local-evidence/ozil-goal-20261015/ 中，不发布测试照片或测试账号凭据。

## 正式上线记录

- 2026-10-15 14:58（Asia/Shanghai），使用正式 wrangler.jsonc 与服务端 secret 文件部署到 https://migosai.design，版本 7d4d731f-c287-4bfa-bcee-b8afb2d2257c，部署 70d08e64-d61a-4f04-96b2-b2cb4a98c291，流量 100%。
- 远端只读核对正式 D1、R2 与 APP_URL，FAL_KEY 为 secret_text，预览 URL 恢复关闭；未把隔离 QA 版本或 QA 数据库发布为生产。
- 线上首页、Ozil 内页、/api/me 和 sitemap 返回 200；Ozil 正式页显示 MiniMax H3、768p 与 300 积分，sitemap 含新页面。未登录生成返回 401。真实浏览器验证导航下拉含原 Rap 和 Ozil 两个入口，已有登录会话及共享余额正常显示。
