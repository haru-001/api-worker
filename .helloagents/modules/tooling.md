# tooling

## 职责

本地开发启动链路与辅助脚本，负责统一拉起 Worker / attempt-worker / UI，管理后台运行状态、运行时 `wrangler` 配置、自启动和日志策略。

## 行为规范

### 本地开发启动
**条件**: 执行 `bun run dev`
**行为**: 由 `scripts/dev.mjs` 解析参数，按需准备 UI 构建、远端配置和 no-hot-cache 配置，再并行启动 `apps/worker`、`apps/attempt-worker` 与 `apps/ui`
**结果**: 本地开发链路可通过单一入口启动

### 运行时配置收敛
**条件**: 执行 `bun run dev -- --remote-d1`、`--no-hot-cache` 或 `--no-attempt-worker`
**行为**: 将运行时生成的 `wrangler` 配置统一写入 `.dev/generated/wrangler/`
**结果**: 应用源码目录不再承担根脚本产生的临时 `wrangler` 文件
**补充**: `prepare:remote-config` 与 `prepare:no-hot-cache-config` 新增 `--output-root`，允许显式指定输出目录；当输出目录不在应用根目录下时，脚本会将 `main` 与 `assets.directory` 改写为绝对路径，避免 Wrangler 按新配置目录错误解析入口文件

### 后台模式与日志
**条件**: 执行 `bun run dev -- --bg`
**行为**: `scripts/dev.mjs` 以守护进程模式拉起开发服务，并记录 `.dev/dev-runner.json`
**结果**: 可通过 `--status` / `--stop` 查看与停止后台实例
**补充**: `--log-mode file|none` 控制后台日志是否写入 `.dev/dev-runner.log`；Windows 后台模式会同时为守护进程子进程启用隐藏窗口，并将 stdout/stderr 显式重定向到日志文件或空设备，降低额外控制台窗口弹出的概率

### Windows 自启动
**条件**: 执行 `bun run autostart -- enable ...`
**行为**: `scripts/autostart.mjs` 使用 Windows 计划任务注册登录触发任务，由隐藏的 PowerShell 启动器再执行 `bun run dev -- --bg`
**结果**: 自启动不再依赖 Startup `.cmd`
**补充**: 登录后实际运行的后台守护分支仍沿用 `scripts/dev.mjs` 的隐藏窗口与日志重定向策略；`status` / `disable` 通过 PowerShell ScheduledTasks API 查询与删除同名任务

## 依赖关系

```yaml
依赖: admin-ui, deploy-workflow
被依赖: -
```
