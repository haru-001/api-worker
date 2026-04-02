#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = {
	worker: {
		localSource: "apps/worker/wrangler.toml",
		remoteSource: "apps/worker/.wrangler.remote.toml",
		localOutput: "apps/worker/.wrangler.local.no-hot-cache.toml",
		remoteOutput: "apps/worker/.wrangler.remote.no-hot-cache.toml",
	},
	"attempt-worker": {
		localSource: "apps/attempt-worker/wrangler.toml",
		remoteSource: "apps/attempt-worker/.wrangler.remote.toml",
		localOutput: "apps/attempt-worker/.wrangler.local.no-hot-cache.toml",
		remoteOutput: "apps/attempt-worker/.wrangler.remote.no-hot-cache.toml",
	},
};

const parseArgs = () => {
	const args = process.argv.slice(2);
	let only = "all";
	let remote = false;
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
		if (arg === "--remote") {
			remote = true;
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

	let selectedTargets;
	if (only === "all") {
		selectedTargets = ["worker", "attempt-worker"];
	} else if (only === "worker" || only === "attempt-worker") {
		selectedTargets = [only];
	} else {
		throw new Error("--only 仅支持 worker / attempt-worker / all");
	}

	return { selectedTargets, remote, outputRoot };
};

const resolveDefaultPath = (relativePath) => path.join(ROOT, relativePath);

const resolveOutputPath = (target, relativePath, outputRoot) => {
	if (!outputRoot) {
		return resolveDefaultPath(relativePath);
	}
	return path.resolve(outputRoot, target, path.basename(relativePath));
};

const resolveSourcePath = (
	target,
	relativePath,
	outputRoot,
	preferOutputRoot,
) => {
	if (preferOutputRoot && outputRoot) {
		return resolveOutputPath(target, relativePath, outputRoot);
	}
	return resolveDefaultPath(relativePath);
};

const stripKvNamespacesBlock = (source) => {
	const lines = source.split(/\r?\n/u);
	const output = [];
	let skipping = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!skipping && trimmed === "[[kv_namespaces]]") {
			skipping = true;
			continue;
		}
		if (skipping) {
			if (trimmed.startsWith("[")) {
				skipping = false;
				output.push(line);
			}
			continue;
		}
		output.push(line);
	}

	return `${output.join("\n").replace(/\n+$/u, "")}\n`;
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

const main = async () => {
	const { selectedTargets, remote, outputRoot } = parseArgs();

	for (const target of selectedTargets) {
		const config = TARGETS[target];
		const sourceRelativePath = remote
			? config.remoteSource
			: config.localSource;
		const outputRelativePath = remote
			? config.remoteOutput
			: config.localOutput;
		const sourcePath = resolveSourcePath(
			target,
			sourceRelativePath,
			outputRoot,
			remote,
		);
		const outputPath = resolveOutputPath(
			target,
			outputRelativePath,
			outputRoot,
		);

		let sourceText = "";
		try {
			sourceText = await readFile(sourcePath, "utf8");
		} catch (error) {
			if (remote) {
				throw new Error(
					`未找到 ${sourceRelativePath}，请先运行 prepare:remote-config`,
				);
			}
			throw error;
		}

		const noHotConfig = stripKvNamespacesBlock(sourceText);
		const finalText = outputRoot
			? rewriteConfigPathsForExternalOutput(
					noHotConfig,
					path.dirname(resolveDefaultPath(config.localSource)),
				)
			: noHotConfig;
		await mkdir(path.dirname(outputPath), { recursive: true });
		await writeFile(outputPath, finalText, "utf8");
		console.log(`✅ 已生成 ${path.relative(ROOT, outputPath)}`);
	}
};

main().catch((error) => {
	console.error(`❌ no-hot 配置生成失败: ${error.message}`);
	process.exit(1);
});
