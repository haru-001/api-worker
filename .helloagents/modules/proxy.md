# proxy 模块

## 职责
- 提供 OpenAI / Anthropic / Gemini 多协议代理
- 支持下游协议与上游渠道类型分离并做请求转换
- 根据权重选择渠道并支持故障回退
- 记录用量日志并回写额度

## 接口定义
- `/v1/*` OpenAI 兼容代理路径
- `/v1/messages` Anthropic Messages 代理路径
- `/v1beta/*` Gemini 代理路径

## 行为规范
- 基于令牌鉴权
- 按渠道权重随机排序
- 调用令牌按模型列表匹配选择，未配置或无列表时回退 `channels.api_key`
- 调用令牌模型列表来自渠道连通测试写回
- done-hub 仅使用 `base_url`，不再按多地址切换
- 令牌鉴权、启用渠道与调用令牌支持短时缓存；禁用/变更会触发分组缓存版本失效
- 失败冷却/阈值判断不做跨请求缓存，确保即时生效
- 支持从非流式 JSON、响应头与流式 SSE（含 `response.usage` 与 `usageMetadata`）解析 usage 字段
- 流式请求自动补 `stream_options.include_usage=true` 以便上游返回 usage
- 流式 usage 解析支持 `full/lite/off` 模式（`lite` 仅解析包含 usage 的事件，并可限制最大扫描字节）
- 对 `/v1/responses` 且上游返回 400/404 时回退为 `/responses` 重试一次
- 可配置失败重试轮询（响应 5xx/429 时触发）
- 记录流式请求标记、首 token 延迟与推理强度到 usage_logs
- usage 事件调度仅传 event 对象，失败请求也必须记录 error usage
- 使用日志与模型能力写入可通过 `USAGE_QUEUE` 异步化（队列不可用时自动回退同步写入）
- 队列写入采用“两态简化逻辑”：未超限时按比例直写/队列，超限后全部直写
- 队列日限额由 `UsageLimiter` DO 维护，限制 `USAGE_QUEUE` 的日内发送量
- 当 usage 解析被跳过或超限时，会记录 `usage_skipped/usage_missing` 用于可观测性
- 上游类型由 `metadata_json.site_type` 决定（`openai/anthropic/gemini`，其他类型视为 openai 兼容）
- 允许 `metadata_json.model_mapping` 将下游模型映射为上游模型
- 允许 `metadata_json.endpoint_overrides` 覆盖 chat/embedding/image 上游地址（可用 `{model}` 占位）
- 允许 `metadata_json.header_override` 与 `metadata_json.query_override` 注入额外上游请求头/查询参数
- Anthropic 默认注入 `anthropic-version=2023-06-01`，可通过 `header_override` 覆盖
- 路由时优先使用模型能力表记录（测试成功的模型），无能力记录时回退渠道声明模型列表
- 当模型在任意渠道中都不被支持时返回 `no_available_channels`，不回退到全部渠道
- 上游失败/超时会记录到能力表并进入冷却期（需在窗口内连续失败达到阈值），冷却期内跳过对应渠道/模型
- 失败计数仅在成功响应时清零
- 仅 429/5xx/408/timeout/exception 计入冷却，4xx 请求错误不触发冷却
- 映射模型场景失败时同时记录下游模型错误，确保冷却窗口生效
- 上游成功响应会刷新能力表，清空错误并延长可用窗口
- 运行时配置优先读取 settings，环境变量仅回退
- CPU 保护相关配置: `proxy_stream_usage_mode`, `proxy_stream_usage_max_bytes`, `proxy_stream_usage_max_parsers`, `proxy_usage_queue_enabled`
- 队列策略配置: `usage_queue_daily_limit`, `usage_queue_direct_write_ratio`
- 默认值: `PROXY_STREAM_USAGE_MODE=full`, `PROXY_STREAM_USAGE_MAX_BYTES=0`, `PROXY_STREAM_USAGE_MAX_PARSERS=0`, `PROXY_USAGE_QUEUE_ENABLED=true`
- `PROXY_STREAM_USAGE_MAX_BYTES` 与 `PROXY_STREAM_USAGE_MAX_PARSERS` 设为 `0` 表示无限制

## 依赖关系
- `channels` / `tokens` / `usage_logs` 表
- `tokenAuth` 中间件
- `channel_model_capabilities` 表
