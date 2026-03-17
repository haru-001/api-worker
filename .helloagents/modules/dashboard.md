# dashboard 模块

## 职责
- 汇总调用统计指标
- 输出按时间、模型、渠道、令牌的聚合数据

## 接口定义
- `GET /api/dashboard` 数据面板汇总

## 行为规范
- 以 `usage_logs` 为统计来源
- `GET /api/dashboard` 支持 `from/to` 时间区间与 `interval=day|week|month` 聚合
- 趋势数据返回 `trend` + `interval` 字段，默认最近 30 个区间
- 可选筛选：`channel_ids` / `token_ids` / `model`
- 管理台默认展示全量时间范围，并在趋势卡片内提供统计颗粒（按日/周/月）
- 统计颗粒与时间范围在前端本地存储并优先复用
- `GET /api/dashboard` 支持短时缓存（TTL 可配置，版本化失效）

## 依赖关系
- `usage_logs` 表
- `tokens` / `channels` 表
