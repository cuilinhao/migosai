# Migos AI 全页面复刻范围与部署设计

## 已确定的目标

以2026-10-02的原站公开界面为视觉和交互基准，在 `migosai.design` 重建独立应用。使用用户指定的 GitHub 仓库、本地八个视频素材和 Cloudflare。域名、素材使用、1:1要求以本轮明确指令为准。

前端验收关注：页面齐全、排版/字体/颜色/间距一致、桌面/平板/手机响应式一致、导航/上传/选择器/弹窗/播放器行为一致。后端为独立实现，不使用原站认证、付款或生成接口。

## 路由与组件

- 营销/工具路由：`/`、`/pricing`、`/showcases`、`/ai-rap-song-generator`、`/privacy-policy`、`/terms-of-service`。
- 认证路由：`/sign-in`、`/sign-up`，以及公共登录弹窗。
- 公共组件：Header、移动导航、仅English的语言菜单、Footer、价格卡、编号FAQ、流程卡、特性卡、播放Dialog、空态与错误提示。
- 视频工具：双槽图片上传和本地预览、文件校验、四种比例、三种时长、两种分辨率、服务端报价、生成状态及结果下载。
- 歌曲工具：普通/自定义模式、五个模型选项、纯伴奏开关、标题/风格/歌词、音频结果与下载。
- 原站认证后的设置/活动/管理页面缺少视觉证据，不宣称已经获得这些页面的1:1规格。

## 技术方向

- 使用 Next.js App Router、TypeScript、Tailwind CSS 和可访问的表单/弹窗组件；页面内容与积分配置独立管理。
- 使用 Cloudflare Workers 承载SSR与API，R2存放用户图片与生成文件，数据库存储用户、任务、订单和积分账本。
- Cloudflare 当前为新 Next.js 项目推荐 vinext（beta），同时保留 OpenNext 文档。正式初始化前进行兼容检查，选择通过构建和Workers预览验证的适配方式，不能只验证本地Next开发服务器。
- 数据库在 D1 与 Postgres/Hyperdrive 中选择一种；Cloudflare原生方案优先评估D1，账本扣费、退款和Webhook必须有事务/幂等保障。
- API Key 放服务端环境变量/Workers Secrets；不写入公开仓库，不使用 `NEXT_PUBLIC_` 前缀。

## 视频任务流

1. 登录校验后签发R2短时上传地址；前端直传两张图片。
2. 服务端校验文件、所有权、参数、余额并建立任务；按独立幂等标识预扣积分。
3. APIMart虚拟素材入库并取得可用 `asset://` 引用；保留图片与左右角色对应关系。
4. 使用参数化提示词提交Seedance 2.5任务；比例和提示词方向保持一致。
5. 后台队列/定时任务推进审核与生成状态；前端仅查询自己的任务接口。不得把长任务的完成完全依赖于用户保持页面打开。
6. 成功结果转存R2；失败按幂等规则退款；记录实际上游美元成本。

原站目前仅展示480P/720P；APIMart虽支持1080P，但不主动往1:1界面增加未出现的选项。上游是否提供适合本应用的签名回调尚未核实；后台轮询作为可实现基线。

## 鉴权、支付与音乐

- 登录使用目标站自己的Google OAuth客户端与HTTPS回调，不能复用源站Client ID。
- 付款服务已由用户明确为 Creem。四档套餐价格、积分、推荐标识和展示文案完整保留源站。支付成功只以验签后的服务端事件为准，不依赖前端跳转。
- APIMart 官方文档已确认音乐生成接口；实现前核对所列旧版Suno模型是否可用，不能把V5选项暗中映射成V6。
- 开发预览可独立完成全部界面；未配置的真实服务要清楚返回不可用状态，不能伪装为生成成功。

## Cloudflare和域名上线

- 将目标域加入用户Cloudflare账号，并核对现有DNS记录，尤其MX/TXT；Namecheap继续作为注册商。
- 使用Cloudflare Workers Custom Domain配置主域和必要的www跳转；生产域名、OAuth回调、存储CORS和Webhook地址一致。
- 若需要迁移Nameserver，使用账号实际分配的值；现有DNSSEC配置需随迁移处理，不填写猜测值。
- 配置生产Secrets、数据库、R2、任务调度、错误日志、生成失败退款与支付幂等检查。

## 当前待接入信息

- Cloudflare账号/目标Zone/Workers及R2授权状态。
- Google OAuth客户端配置。
- Creem店铺、四档产品及测试/生产配置。
- 音乐生成API服务与凭据。
- 本地八个视频与源站01–08的画面顺序匹配，以及首页独立参考片的素材对应。

这些信息不阻止公开页面的前端实现；对应真实业务功能必须等配置有效后联调。

## 验证标准

- 八路由在1440/768/390逐页对比截图；保留基准，检查文字换行、卡片比例与页面间距。
- 验证上传格式/大小、删除图片、比例选择、菜单、Google入口、弹窗关闭和键盘操作、视频播放、歌曲模式切换。
- 业务联调验证：鉴权、签名上传、任务完成/失败/取消、重复请求、并发积分、支付重复事件、失败退款、R2结果下载。
- 执行Workers实际运行时构建和预览；完成后再给出可部署/已部署结论。

## 官方参考

- [Cloudflare Next.js / vinext](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare OpenNext](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [Workers运行限制](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers自定义域名](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [R2预签名地址](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [APIMart Seedance 2.5](https://docs.apimart.ai/cn/api-reference/videos/seedance-2-5/generation)
