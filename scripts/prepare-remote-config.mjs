#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = {
	worker: {
		source: "apps/worker/wrangler.toml",
		output: "apps/worker/.wrangler.remote.toml",
	},
	"attempt-worker": {
		source: "apps/attempt-worker/wrangler.toml",
		output: "apps/attempt-worker/.wrangler.remote.toml",
	},
};

const uuidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kvIdPattern = /^[0-9a-f]{32}$/i;

const parseArgs = () => {
	const args = process.argv.slice(2);
	let only = "all";
	let outputRoot = "";

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--only") {
			const value = args[index + 1];
			if (value) {
				only = value;
				index += 1;
			}
			continue;
		}
		if (arg === "--output-root") {
			const value = args[index + 1];
			if (value) {
				outputRoot = value;
				index += 1;
			}
		}
	}

	if (only === "all") {
		return {
			selectedTargets: ["worker", "attempt-worker"],
			outputRoot,
		};
	}
	if (only === "worker" || only === "attempt-worker") {
		return {
			selectedTargets: [only],
			outputRoot,
		};
	}

	throw new Error("--only 仅支持 worker / attempt-worker / all");
};

const parseEnvText = (input) => {
	const result = {};
	for (const rawLine of input.split(/\r?\n/u)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}
		const separatorIndex = line.indexOf("=");
		if (separatorIndex <= 0) {
			continue;
		}
		const key = line
			.slice(0, separatorIndex)
			.replace(/^export\s+/u, "")
			.trim();
		let value = line.slice(separatorIndex + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		result[key] = value;
	}
	return result;
};

const tryReadProjectEnv = async () => {
	const envPath = path.join(ROOT, ".env");
	try {
		await access(envPath);
		const raw = await readFile(envPath, "utf8");
		return parseEnvText(raw);
	} catch {
		return {};
	}
};

const firstNonEmpty = (...values) => {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return "";
};

const resolveRemoteIds = async () => {
	const projectEnv = await tryReadProjectEnv();

	const d1DatabaseId = firstNonEmpty(
		process.env.CLOUDFLARE_D1_DATABASE_ID,
		process.env.CF_D1_DATABASE_ID,
		process.env.D1_DATABASE_ID,
		projectEnv.CLOUDFLARE_D1_DATABASE_ID,
		projectEnv.CF_D1_DATABASE_ID,
		projectEnv.D1_DATABASE_ID,
	);
	const kvHotId = firstNonEmpty(
		process.env.CLOUDFLARE_KV_HOT_ID,
		process.env.CF_KV_HOT_NAMESPACE_ID,
		process.env.KV_HOT_NAMESPACE_ID,
		projectEnv.CLOUDFLARE_KV_HOT_ID,
		projectEnv.CF_KV_HOT_NAMESPACE_ID,
		projectEnv.KV_HOT_NAMESPACE_ID,
	);

	if (!uuidPattern.test(d1DatabaseId)) {
		throw new Error(
			"缺少有效 D1 数据库 ID，请在环境变量或 .env 中设置 CLOUDFLARE_D1_DATABASE_ID（UUID）",
		);
	}
	if (!kvIdPattern.test(kvHotId)) {
		throw new Error(
			"缺少有效 KV namespace ID，请在环境变量或 .env 中设置 CLOUDFLARE_KV_HOT_ID（32位十六进制）",
		);
	}

	return { d1DatabaseId, kvHotId };
};

const buildRemoteConfig = (sourceText, ids) => {
	const databaseReplaced = sourceText.replace(
		/(\bdatabase_id\s*=\s*")[^"]*(")/u,
		`$1${ids.d1DatabaseId}$2`,
	);
	if (databaseReplaced === sourceText) {
		throw new Error("未找到 database_id 配置项，无法生成远端配置");
	}

	const kvReplaced = databaseReplaced.replace(
		/(\[\[kv_namespaces\]\][\s\S]*?\bbinding\s*=\s*"KV_HOT"[\s\S]*?\bid\s*=\s*")[^"]*(")/u,
		`$1${ids.kvHotId}$2`,
	);
	if (kvReplaced === databaseReplaced) {
		throw new Error("未找到 KV_HOT 的 id 配置项，无法生成远端配置");
	}

	return kvReplaced
		.replace(
			/(\[\[d1_databases\]\][\s\S]*?\bdatabase_id\s*=\s*"[^"]*"\s*)(?!\bremote\s*=)/u,
			"$1remote = true\n",
		)
		.replace(
			/(\[\[kv_namespaces\]\][\s\S]*?\bid\s*=\s*"[^"]*"\s*)(?!\bremote\s*=)/u,
			"$1remote = true\n",
		);
};

const toTomlLiteralPath = (filePath) =>
	`'${path.resolve(filePath).replace(/'/g, "''")}'`;

const rewriteConfigPathsForExternalOutput = (sourceText, sourceDir) => {
	const rewriteMaybeRelative = (rawPath) => {
		if (path.isAbsolute(rawPath)) {
			return toTomlLiteralPath(rawPath);
		}
		return toTomlLiteralPath(path.resolve(sourceDir, rawPath));
	};

	return sourceText
		.replace(
			/(\bmain\s*=\s*)(["'])([^"']+)\2/u,
			(_, prefix, _quote, rawPath) =>
				`${prefix}${rewriteMaybeRelative(rawPath)}`,
		)
		.replace(
			/(\[assets\][\s\S]*?\bdirectory\s*=\s*)(["'])([^"']+)\2/u,
			(_, prefix, _quote, rawPath) =>
				`${prefix}${rewriteMaybeRelative(rawPath)}`,
		);
};

const resolveDefaultPath = (relativePath) => path.join(ROOT, relativePath);

const resolveOutputPath = (target, relativePath, outputRoot) => {
	if (!outputRoot) {
		return resolveDefaultPath(relativePath);
	}
	return path.resolve(outputRoot, target, path.basename(relativePath));
};

const main = async () => {
	const { selectedTargets, outputRoot } = parseArgs();
	const ids = await resolveRemoteIds();

	for (const target of selectedTargets) {
		const config = TARGETS[target];
		const sourcePath = resolveDefaultPath(config.source);
		const outputPath = resolveOutputPath(target, config.output, outputRoot);
		const sourceText = await readFile(sourcePath, "utf8");
		const remoteText = buildRemoteConfig(sourceText, ids);
		const finalText = outputRoot
			? rewriteConfigPathsForExternalOutput(
					remoteText,
					path.dirname(sourcePath),
				)
			: remoteText;
		await mkdir(path.dirname(outputPath), { recursive: true });
		await writeFile(outputPath, finalText, "utf8");
		console.log(`✅ 已生成 ${path.relative(ROOT, outputPath)}`);
	}
};

main().catch((error) => {
	console.error(`❌ 远端配置生成失败: ${error.message}`);
	process.exit(1);
});
