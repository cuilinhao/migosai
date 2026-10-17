# FlyingCar 图片尺寸验证素材

这些纯色测试图片由仓库现有的 `sharp` 工具一次性编码生成，尺寸写在文件名中，不含用户照片或外部下载内容。PNG 覆盖合法范围、边长边界和比例边界；JPEG 包含 baseline 和 progressive；WebP 包含 VP8、VP8L 与带 alpha 的 VP8X 容器。

测试运行时只读取保存的真实文件，不加载 `sharp`。生产尺寸解析使用纯 TypeScript，无原生依赖，也不解压像素；损坏测试在内存中截断或修改这些文件的容器头。
