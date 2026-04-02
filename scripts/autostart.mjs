#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rawArgs = process.argv.slice(2);
const action = rawArgs[0]?.trim().toLowerCase() ?? "interactive";
const devArgs = rawArgs.slice(1);

const autostartTaskName = "api-worker-dev-autostart";
const repoRoot = process.cwd();

const interactiveEnableOptions = [
	{ flag: "--no-ui", label: "关闭热加载 UI" },
	{ flag: "--no-attempt-worker", label: "不启动调用执行器 attempt-worker" },
	{ flag: "--no-hot-cache", label: "禁用热缓存 KV_HOT" },
	{ flag: "--remote-d1", label: "连接云端 D1/KV（执行仍在本地）" },
	{ flag: "--remote-worker", label: "主 worker / attempt-worker 走远端预览" },
];

const uiBuildModeOptions = [
	{ mode: "1", label: "构建 UI（--build-ui）", flags: ["--build-ui"] },
	{
		mode: "2",
		label: "跳过 UI 预构建（--skip-ui-build）",
		flags: ["--skip-ui-build"],
	},
];

const backgroundLogModeOptions = [
	{ mode: "1", label: "写入日志文件（默认）", flags: [] },
	{
		mode: "2",
		label: "关闭后台日志（--log-mode none）",
		flags: ["--log-mode", "none"],
	},
];

const escapeForSingleQuotedPowerShell = (value) =>
	String(value).replace(/'/g, "''");

const quoteWindowsArgument = (arg) => {
	const text = String(arg);
	if (text.length === 0) {
		return '""';
	}
	if (!/[\s"]/u.test(text)) {
		return text;
	}
	return `"${text.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, "$1$1")}"`;
};

const normalizeDevArgs = (args) =>
	args
		.filter(Boolean)
		.map((item) => item.trim())
		.filter((item) => item.length > 0 && item !== "--bg");

const buildTaskArguments = (args) => {
	const normalizedArgs = normalizeDevArgs(args);
	return ["run", "dev", "--", ...normalizedArgs, "--bg"];
};

const encodePowerShellCommand = (script) =>
	Buffer.from(script, "utf16le").toString("base64");

const resolveBunCommand = () => {
	if (process.env.BUN_BIN && existsSync(process.env.BUN_BIN)) {
		return process.env.BUN_BIN;
	}
	const npmExec = process.env.npm_execpath;
	if (npmExec && existsSync(npmExec)) {
		const npmExecBaseName = path.basename(npmExec).toLowerCase();
		if (npmExecBaseName === "bun" || npmExecBaseName === "bun.exe") {
			return npmExec;
		}
	}
	if (process.env.BUN_INSTALL) {
		const candidate = path.join(
			process.env.BUN_INSTALL,
			"bin",
			process.platform === "win32" ? "bun.exe" : "bun",
		);
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	if (process.platform === "win32") {
		const whereResult = spawnSync("where.exe", ["bun"], { encoding: "utf8" });
		if (whereResult.status === 0) {
			const firstMatch = whereResult.stdout
				.split(/\r?\n/u)
				.map((item) => item.trim())
				.find(Boolean);
			if (firstMatch) {
				return firstMatch;
			}
		}
	}
	return "bun";
};

const printUsage = () => {
	console.log("用法:");
	console.log("  bun run autostart");
	console.log(
		"  bun run autostart -- enable [dev 参数，空格分隔，例如 --no-ui --remote-d1]",
	);
	console.log("  bun run autostart -- disable");
	console.log("  bun run autostart -- status");
};

const parseInteractiveSelection = (raw, maxIndex) => {
	const text = String(raw ?? "").trim();
	if (text.length === 0) {
		return [];
	}
	const parts = text
		.split(/[\s,，、]+/u)
		.map((item) => item.trim())
		.filter(Boolean);
	const numbers = [];
	for (const part of parts) {
		const value = Number(part);
		if (!Number.isInteger(value) || value < 1 || value > maxIndex) {
			throw new Error(
				`无效编号 "${part}"，请输入 1-${maxIndex} 之间的数字，可用空格分隔。`,
			);
		}
		if (!numbers.includes(value)) {
			numbers.push(value);
		}
	}
	return numbers;
};

const buildInteractiveEnableArgs = (selection) =>
	parseInteractiveSelection(selection, interactiveEnableOptions.length).map(
		(index) => interactiveEnableOptions[index - 1].flag,
	);

const parseUiBuildModeArgs = (selection) => {
	const mode = String(selection ?? "").trim();
	if (mode.length === 0) {
		return ["--skip-ui-build"];
	}
	const matched = uiBuildModeOptions.find((item) => item.mode === mode);
	if (!matched) {
		throw new Error("UI 预构建策略无效，请输入 1 / 2。");
	}
	return matched.flags;
};

const parseBackgroundLogModeArgs = (selection) => {
	const mode = String(selection ?? "").trim();
	if (mode.length === 0) {
		return [];
	}
	const matched = backgroundLogModeOptions.find((item) => item.mode === mode);
	if (!matched) {
		throw new Error("后台日志策略无效，请输入 1 / 2。");
	}
	return matched.flags;
};

const ensureWindows = () => {
	if (process.platform !== "win32") {
		throw new Error("当前仅支持 Windows 自启动脚本。");
	}
};

const runPowerShell = (script) => {
	const encodedCommand = Buffer.from(script, "utf16le").toString("base64");
	const result = spawnSync(
		"powershell.exe",
		["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedCommand],
		{ encoding: "utf8" },
	);
	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		const errorText = result.stderr?.trim() || result.stdout?.trim();
		throw new Error(errorText || "PowerShell 执行失败。");
	}
	return result.stdout.trim();
};

const runPowerShellJson = (script) => {
	const stdout = runPowerShell(script);
	if (!stdout) {
		return null;
	}
	return JSON.parse(stdout);
};

const buildScheduledTaskLauncher = (args) => {
	const bunCommand = resolveBunCommand();
	const taskArgs = buildTaskArguments(args);
	const escapedBunCommand = escapeForSingleQuotedPowerShell(bunCommand);
	const escapedRepoRoot = escapeForSingleQuotedPowerShell(repoRoot);
	const argumentList = taskArgs
		.map((item) => `'${escapeForSingleQuotedPowerShell(item)}'`)
		.join(", ");
	const hiddenLauncherScript = [
		"$ErrorActionPreference = 'Stop'",
		`Start-Process -FilePath '${escapedBunCommand}' -ArgumentList @(${argumentList}) -WorkingDirectory '${escapedRepoRoot}' -WindowStyle Hidden`,
	].join("\n");

	return {
		execute: "powershell.exe",
		arguments: `-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${encodePowerShellCommand(hiddenLauncherScript)}`,
	};
};

const getAutostartTaskInfo = () => {
	ensureWindows();
	const taskName = escapeForSingleQuotedPowerShell(autostartTaskName);
	return runPowerShellJson(`
$ErrorActionPreference = 'Stop'
$task = Get-ScheduledTask -TaskName '${taskName}' -ErrorAction SilentlyContinue
if ($null -eq $task) {
  [pscustomobject]@{
    enabled = $false
  } | ConvertTo-Json -Compress
  return
}
$action = $task.Actions | Select-Object -First 1
[pscustomobject]@{
  enabled = $true
  taskName = $task.TaskName
  state = [string]$task.State
  execute = $action.Execute
  arguments = $action.Arguments
  workingDirectory = $action.WorkingDirectory
} | ConvertTo-Json -Compress
`);
};

const enableAutostart = (args) => {
	ensureWindows();
	const escapedTaskName = escapeForSingleQuotedPowerShell(autostartTaskName);
	const launcher = buildScheduledTaskLauncher(args);
	const escapedExecute = escapeForSingleQuotedPowerShell(launcher.execute);
	const escapedArguments = escapeForSingleQuotedPowerShell(launcher.arguments);
	const escapedRepoRoot = escapeForSingleQuotedPowerShell(repoRoot);

	const result = runPowerShellJson(`
$ErrorActionPreference = 'Stop'
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute '${escapedExecute}' -Argument '${escapedArguments}' -WorkingDirectory '${escapedRepoRoot}'
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName '${escapedTaskName}' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'api-worker 开发服务自启动' -Force | Out-Null
[pscustomobject]@{
  taskName = '${escapedTaskName}'
  execute = $action.Execute
  arguments = $action.Arguments
  workingDirectory = $action.WorkingDirectory
} | ConvertTo-Json -Compress
`);

	console.log("✅ 已开启自启动。");
	console.log(`计划任务: ${result.taskName}`);
	console.log(`程序: ${result.execute}（隐藏启动器）`);
	console.log(`参数: ${result.arguments}`);
	console.log(`工作目录: ${result.workingDirectory}`);
};

const disableAutostart = () => {
	ensureWindows();
	const taskName = escapeForSingleQuotedPowerShell(autostartTaskName);
	const result = runPowerShellJson(`
$ErrorActionPreference = 'Stop'
$task = Get-ScheduledTask -TaskName '${taskName}' -ErrorAction SilentlyContinue
if ($null -eq $task) {
  [pscustomobject]@{ removed = $false } | ConvertTo-Json -Compress
  return
}
Unregister-ScheduledTask -TaskName '${taskName}' -Confirm:$false
[pscustomobject]@{ removed = $true } | ConvertTo-Json -Compress
`);
	if (result?.removed) {
		console.log("✅ 已关闭自启动。");
		console.log(`已删除计划任务: ${autostartTaskName}`);
		return;
	}
	console.log("ℹ️ 当前未开启自启动。");
};

const showStatus = () => {
	const task = getAutostartTaskInfo();
	if (!task?.enabled) {
		console.log("ℹ️ 自启动状态：未开启。");
		return;
	}
	console.log("✅ 自启动状态：已开启。");
	console.log(`计划任务: ${task.taskName}`);
	console.log(`任务状态: ${task.state}`);
	console.log(`程序: ${task.execute}`);
	console.log(`参数: ${task.arguments}`);
	console.log(`工作目录: ${task.workingDirectory}`);
};

const runInteractive = async () => {
	console.log("交互模式：自启动配置");
	showStatus();
	console.log("");
	const rl = createInterface({ input, output });
	try {
		while (true) {
			console.log("1. 开始（开启自启动）");
			console.log("2. 关闭（移除自启动）");
			console.log("3. 状态（查看当前配置）");
			console.log("0. 退出");
			const answer = (await rl.question("请选择操作编号: "))
				.trim()
				.toLowerCase();
			if (answer === "0") {
				console.log("已退出交互模式。");
				return;
			}
			if (answer === "1") {
				console.log("");
				console.log("开始自启动：请选择要附加的参数（可多选）");
				for (let i = 0; i < interactiveEnableOptions.length; i += 1) {
					const item = interactiveEnableOptions[i];
					console.log(`${i + 1}. ${item.label}: ${item.flag}`);
				}
				const selection = await rl.question(
					"输入编号（示例: 1 3；直接回车=不附加参数）: ",
				);
				const args = buildInteractiveEnableArgs(selection);
				console.log("");
				console.log("UI 预构建策略（单选）:");
				for (const option of uiBuildModeOptions) {
					console.log(`${option.mode}. ${option.label}`);
				}
				const uiBuildMode = await rl.question(
					"请选择 UI 预构建策略（默认 2）: ",
				);
				const uiBuildArgs = parseUiBuildModeArgs(uiBuildMode);
				console.log("");
				console.log("后台日志策略（单选）:");
				for (const option of backgroundLogModeOptions) {
					console.log(`${option.mode}. ${option.label}`);
				}
				const logMode = await rl.question("请选择后台日志策略（默认 1）: ");
				const finalArgs = [
					...args,
					...uiBuildArgs,
					...parseBackgroundLogModeArgs(logMode),
				];
				enableAutostart(finalArgs);
				return;
			}
			if (answer === "2") {
				disableAutostart();
				return;
			}
			if (answer === "3") {
				showStatus();
				console.log("");
				continue;
			}
			console.log("输入无效，请输入 0 / 1 / 2 / 3。");
		}
	} finally {
		rl.close();
	}
};

const main = async () => {
	if (action === "interactive") {
		await runInteractive();
		return;
	}
	if (action === "help" || action === "--help" || action === "-h") {
		printUsage();
		return;
	}
	if (action === "enable") {
		enableAutostart(devArgs);
		return;
	}
	if (action === "disable") {
		disableAutostart();
		return;
	}
	if (action === "status") {
		showStatus();
		return;
	}
	printUsage();
};

try {
	await main();
} catch (error) {
	console.error(`❌ ${error.message}`);
	process.exit(1);
}
