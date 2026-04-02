import type { D1Database } from "@cloudflare/workers-types";
import type { Bindings } from "../env";
import { runCheckin, summarizeCheckin, type CheckinResultItem, type CheckinSummary } from "./checkin";
import { beijingDateString, nowIso } from "../utils/time";
import { listChannels, getChannelById, updateChannelCheckinResult } from "./channel-repo";
import { getProxyRuntimeSettings } from "./settings";
import { listCallTokens, updateCallTokenModels } from "./channel-call-token-repo";
import { updateChannelTestResult } from "./channel-testing";
import { runDisabledChannelRecoveryProbe } from "./channel-recovery-task";
import type {
	SiteTaskCheckinResponse,
	SiteTaskProbeRequest,
	SiteTaskProbeResponse,
	SiteTaskTestRequest,
	SiteTaskTestResponse,
} from "./site-task-contract";
import { testChannelTokens } from "./channel-testing";

type SiteTaskRuntime = {
	concurrency: number;
	timeoutMs: number;
	fallbackEnabled: boolean;
};

type InternalWorkerResponse = {
	ok: boolean;
	status: number;
	headers: {
		get(name: string): string | null;
	};
	json(): Promise<unknown>;
	text(): Promise<string>;
};

export type CheckinRunResult = {
	results: CheckinResultItem[];
	summary: CheckinSummary;
	runsAt: string;
};

export type DisabledChannelRecoveryResult = {
	attempted: boolean;
	recovered: boolean;
	reason:
		| "recovered"
		| "already_active"
		| "no_disabled_channel"
		| "missing_token"
		| "token_model_test_failed"
		| "completion_probe_failed";
	channel_id?: string;
	channel_name?: string;
	model?: string;
};

export type DisabledChannelRecoveryBatchResult = {
	total: number;
	attempted: number;
	recovered: number;
	failed: number;
	items: DisabledChannelRecoveryResult[];
};

function createTimeoutSignal(timeoutMs: number) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	return {
		signal: controller.signal,
		clear: () => clearTimeout(timer),
	};
}

async function readInternalError(
	response: InternalWorkerResponse,
): Promise<string> {
	const contentType = response.headers.get("content-type") ?? "";
	if (contentType.includes("application/json")) {
		const payload = await response.json().catch(() => null);
		if (payload && typeof payload === "object") {
			const record = payload as Record<string, unknown>;
			const message = record.error ?? record.message;
			if (typeof message === "string" && message.trim()) {
				return message.trim();
			}
		}
	}
	const text = await response.text().catch(() => "");
	return text.trim() || `HTTP ${response.status}`;
}

async function callAttemptWorker<T>(
	env: Bindings,
	path: string,
	payload: unknown,
	timeoutMs: number,
): Promise<T> {
	const localAttemptWorkerUrl = env.LOCAL_ATTEMPT_WORKER_URL?.trim();
	const binding = env.ATTEMPT_WORKER;
	if (!localAttemptWorkerUrl && !binding) {
		throw new Error("attempt_worker_unavailable");
	}
	const targetUrl = localAttemptWorkerUrl
		? `${localAttemptWorkerUrl.replace(/\/+$/u, "")}${path}`
		: `https://attempt-worker${path}`;
	const requestInit: RequestInit = {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	};
	const executeRequest = async (): Promise<InternalWorkerResponse> =>
		localAttemptWorkerUrl
			? await fetch(targetUrl, requestInit)
			: await binding!.fetch(targetUrl, requestInit as never);

	if (timeoutMs > 0) {
		const { signal, clear } = createTimeoutSignal(timeoutMs);
		requestInit.signal = signal;
		try {
			const response = await executeRequest();
			if (!response.ok) {
				throw new Error(await readInternalError(response));
			}
			return (await response.json()) as T;
		} finally {
			clear();
		}
	}
	const response = await executeRequest();
	if (!response.ok) {
		throw new Error(await readInternalError(response));
	}
	return (await response.json()) as T;
}

async function getSiteTaskRuntime(db: D1Database): Promise<SiteTaskRuntime> {
	const runtimeSettings = await getProxyRuntimeSettings(db);
	return {
		concurrency: Math.max(1, runtimeSettings.site_task_concurrency),
		timeoutMs: Math.max(1, runtimeSettings.site_task_timeout_ms),
		fallbackEnabled: runtimeSettings.site_task_fallback_enabled,
	};
}

async function dispatchWithFallback<T>(
	env: Bindings,
	runtime: SiteTaskRuntime,
	path: string,
	payload: unknown,
	fallback: () => Promise<T>,
): Promise<T> {
	try {
		return await callAttemptWorker<T>(env, path, payload, runtime.timeoutMs);
	} catch (error) {
		if (!runtime.fallbackEnabled) {
			throw error;
		}
		return fallback();
	}
}

async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let nextIndex = 0;
	const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
		while (true) {
			const current = nextIndex;
			nextIndex += 1;
			if (current >= items.length) {
				return;
			}
			results[current] = await worker(items[current], current);
		}
	});
	await Promise.all(runners);
	return results;
}

async function applyTokenModelUpdates(
	db: D1Database,
	tokenRows: Array<{ id: string }>,
	items: SiteTaskTestResponse["items"],
) {
	const tokenIdSet = new Set(tokenRows.map((row) => row.id));
	for (const item of items) {
		if (!item.ok || !item.tokenId || !tokenIdSet.has(item.tokenId)) {
			continue;
		}
		await updateCallTokenModels(db, item.tokenId, item.models, nowIso());
	}
}

export async function executeSiteTestTask(
	db: D1Database,
	env: Bindings,
	payload: SiteTaskTestRequest,
): Promise<SiteTaskTestResponse> {
	const runtime = await getSiteTaskRuntime(db);
	return dispatchWithFallback(env, runtime, "/internal/site-task/test", payload, () =>
		testChannelTokens(payload.base_url, payload.tokens),
	);
}

export async function executeSiteCheckinTask(
	db: D1Database,
	env: Bindings,
	payload: {
		site: {
			id: string;
			name: string;
			base_url: string;
			checkin_url?: string | null;
			system_token?: string | null;
			system_userid?: string | null;
		};
	},
): Promise<SiteTaskCheckinResponse> {
	const runtime = await getSiteTaskRuntime(db);
	return dispatchWithFallback(env, runtime, "/internal/site-task/checkin", payload, async () => ({
		result: await runCheckin(payload.site),
	}));
}

export async function executeSiteProbeTask(
	db: D1Database,
	env: Bindings,
	payload: SiteTaskProbeRequest,
): Promise<SiteTaskProbeResponse> {
	const runtime = await getSiteTaskRuntime(db);
	return dispatchWithFallback(env, runtime, "/internal/site-task/probe", payload, async () => ({
		result: await runDisabledChannelRecoveryProbe(payload.channel, payload.tokens),
	}));
}

export async function runCheckinSingleViaWorker(
	db: D1Database,
	env: Bindings,
	channelId: string,
	now: Date = new Date(),
): Promise<{ result: CheckinResultItem; runsAt: string } | null> {
	const channel = await getChannelById(db, channelId);
	if (!channel) {
		return null;
	}
	const today = beijingDateString(now);
	const alreadyChecked =
		channel.last_checkin_date === today &&
		(channel.last_checkin_status === "success" ||
			channel.last_checkin_status === "skipped");
	if (alreadyChecked) {
		return {
			result: {
				id: channel.id,
				name: channel.name,
				status: "skipped",
				message: channel.last_checkin_message ?? "今日已签到",
				checkin_date: channel.last_checkin_date ?? today,
			},
			runsAt: now.toISOString(),
		};
	}
	const dispatched = await executeSiteCheckinTask(db, env, {
		site: {
			id: channel.id,
			name: channel.name,
			base_url: String(channel.base_url),
			checkin_url: channel.checkin_url ?? null,
			system_token: channel.system_token ?? null,
			system_userid: channel.system_userid ?? null,
		},
	});
	const checkinDate = dispatched.result.checkin_date ?? today;
	await updateChannelCheckinResult(db, channel.id, {
		last_checkin_date: checkinDate,
		last_checkin_status: dispatched.result.status,
		last_checkin_message: dispatched.result.message,
		last_checkin_at: now.toISOString(),
	});
	return {
		result: { ...dispatched.result, checkin_date: checkinDate },
		runsAt: now.toISOString(),
	};
}

export async function runCheckinAllViaWorker(
	db: D1Database,
	env: Bindings,
	now: Date = new Date(),
): Promise<CheckinRunResult> {
	const runtime = await getSiteTaskRuntime(db);
	const channels = await listChannels(db, { orderBy: "created_at" });
	const today = beijingDateString(now);
	const resultSlots: Array<CheckinResultItem | null> = [];
	const pending: Array<{ slotIndex: number; channel: (typeof channels)[number] }> = [];

	for (const channel of channels) {
		const rawEnabled = channel.checkin_enabled ?? 0;
		const checkinEnabled =
			typeof rawEnabled === "boolean" ? rawEnabled : Number(rawEnabled) === 1;
		if (!checkinEnabled) {
			continue;
		}
		const alreadyChecked =
			channel.last_checkin_date === today &&
			(channel.last_checkin_status === "success" ||
				channel.last_checkin_status === "skipped");
		if (alreadyChecked) {
			resultSlots.push({
				id: channel.id,
				name: channel.name,
				status: "skipped",
				message: channel.last_checkin_message ?? "今日已签到",
				checkin_date: channel.last_checkin_date ?? today,
			});
			continue;
		}
		const slotIndex = resultSlots.length;
		resultSlots.push(null);
		pending.push({ slotIndex, channel });
	}

	await mapWithConcurrency(pending, runtime.concurrency, async ({ slotIndex, channel }) => {
		const dispatched = await executeSiteCheckinTask(db, env, {
			site: {
				id: channel.id,
				name: channel.name,
				base_url: String(channel.base_url),
				checkin_url: channel.checkin_url ?? null,
				system_token: channel.system_token ?? null,
				system_userid: channel.system_userid ?? null,
			},
		});
		const checkinDate = dispatched.result.checkin_date ?? today;
		await updateChannelCheckinResult(db, channel.id, {
			last_checkin_date: checkinDate,
			last_checkin_status: dispatched.result.status,
			last_checkin_message: dispatched.result.message,
			last_checkin_at: now.toISOString(),
		});
		resultSlots[slotIndex] = {
			...dispatched.result,
			checkin_date: checkinDate,
		};
		return null;
	});

	const results = resultSlots.filter(
		(item): item is CheckinResultItem => item !== null,
	);
	return {
		results,
		summary: summarizeCheckin(results),
		runsAt: now.toISOString(),
	};
}

async function markDisabledChannelRecovered(
	db: D1Database,
	channelId: string,
): Promise<boolean> {
	const updatedAt = nowIso();
	const updateResult = await db
		.prepare(
			"UPDATE channels SET status = ?, updated_at = ? WHERE id = ? AND status = ?",
		)
		.bind("active", updatedAt, channelId, "disabled")
		.run();
	return Number(updateResult.meta?.changes ?? 0) > 0;
}

export async function recoverDisabledChannelsViaWorker(
	db: D1Database,
	env: Bindings,
): Promise<DisabledChannelRecoveryBatchResult> {
	const runtime = await getSiteTaskRuntime(db);
	const disabledChannels = await listChannels(db, {
		filters: { status: "disabled" },
		orderBy: "created_at",
		order: "DESC",
	});
	const probeTargets = disabledChannels.filter(
		(channel) => Number(channel.auto_disabled_permanent ?? 0) <= 0,
	);
	if (probeTargets.length === 0) {
		return {
			total: 0,
			attempted: 0,
			recovered: 0,
			failed: 0,
			items: [],
		};
	}

	const callTokenRows = await listCallTokens(db, {
		channelIds: probeTargets.map((channel) => channel.id),
	});
	const callTokenMap = new Map<string, typeof callTokenRows>();
	for (const row of callTokenRows) {
		const list = callTokenMap.get(row.channel_id) ?? [];
		list.push(row);
		callTokenMap.set(row.channel_id, list);
	}

	const taskResults = await mapWithConcurrency(
		probeTargets,
		runtime.concurrency,
		async (channel) => {
			const tokenRows = callTokenMap.get(channel.id) ?? [];
			const dispatched = await executeSiteProbeTask(db, env, {
				channel: {
					id: channel.id,
					name: channel.name,
					base_url: String(channel.base_url),
					api_key: String(channel.api_key ?? ""),
				},
				tokens: tokenRows.map((row) => ({
					id: row.id,
					name: row.name,
					api_key: row.api_key,
				})),
			});
			const result = dispatched.result;

			if (result.reason === "token_model_test_failed") {
				await updateChannelTestResult(db, channel.id, {
					ok: false,
					elapsed: result.elapsed,
				});
			} else if (result.models.length > 0) {
				await updateChannelTestResult(db, channel.id, {
					ok: true,
					elapsed: result.elapsed,
					models: result.models,
				});
				await applyTokenModelUpdates(db, tokenRows, result.items);
			}

			const recovered = result.recovered
				? await markDisabledChannelRecovered(db, channel.id)
				: false;
			return {
				attempted: result.attempted,
				recovered,
				reason:
					recovered
						? "recovered"
						: result.recovered
							? "already_active"
							: result.reason,
				channel_id: result.channel_id,
				channel_name: result.channel_name,
				model: result.model,
			} satisfies DisabledChannelRecoveryResult;
		},
	);

	const attempted = taskResults.filter((item) => item.attempted).length;
	const recovered = taskResults.filter((item) => item.recovered).length;
	return {
		total: taskResults.length,
		attempted,
		recovered,
		failed: attempted - recovered,
		items: taskResults,
	};
}
