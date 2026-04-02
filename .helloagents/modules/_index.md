# 模块索引

> 通过此文件快速定位模块文档

## 模块清单

| 模块 | 职责 | 状态 | 文档 |
|------|------|------|------|
| auth | 管理员登录与会话 | 🚧 | [auth.md](./auth.md) |
| proxy | OpenAI 兼容代理与转发 | 🚧 | [proxy.md](./proxy.md) |
| channels | 渠道管理与健康检查 | 🚧 | [channels.md](./channels.md) |
| sites | 站点聚合管理 | 🚧 | [sites.md](./sites.md) |
| models | 模型广场与聚合 | 🚧 | [models.md](./models.md) |
| tokens | 令牌管理与额度 | 🚧 | [tokens.md](./tokens.md) |
| usage | 使用日志与留存 | 🚧 | [usage.md](./usage.md) |
| dashboard | 数据面板统计 | 🚧 | [dashboard.md](./dashboard.md) |
| settings | 系统配置 | 🚧 | [settings.md](./settings.md) |
| checkin | 签到站点管理 | 🚧 | [checkin.md](./checkin.md) |
| admin-ui | 管理台前端 | 🚧 | [admin-ui.md](./admin-ui.md) |
| deploy-workflow | GitHub Actions 部署流程 | 🚧 | [deploy-workflow.md](./deploy-workflow.md) |
| tooling | 本地开发与自启动脚本 | 🚧 | [tooling.md](./tooling.md) |

## 模块依赖关系

```
admin-ui → auth, sites, models, tokens, usage, dashboard, settings
sites → channels, checkin
proxy → channels, tokens, usage
dashboard → usage, tokens
models → channels
usage → settings
deploy-workflow → admin-ui, worker
tooling → admin-ui, deploy-workflow
```

## 状态说明
- ✅ 稳定
- 🚧 开发中
- 📝 规划中
