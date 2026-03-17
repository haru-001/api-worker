# models 模块

## 职责
- 汇总各渠道模型列表
- 输出模型与渠道的映射关系

## 接口定义
- `GET /api/models` 模型广场列表
- `GET /api/user/models` New API 兼容用户模型列表

## 行为规范
- 仅聚合启用状态的渠道
- 使用“模型广场测试结果”作为可用模型来源
- 模型归一化支持字符串数组与对象数组（对象取 `id` 字段）
- 管理台模型广场支持搜索、渠道筛选与分页展示
- `GET /api/models` 支持短时缓存（TTL 可配置，版本化失效）

## 依赖关系
- `channels` 表
- `channel_model_capabilities` 表
