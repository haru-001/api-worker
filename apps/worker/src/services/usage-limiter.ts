import type {
	DurableObjectNamespace,
	DurableObjectState,
} from "@cloudflare/workers-types";
import { beijingDateString } from "../utils/time";

const LIMITER_NAME = "usage-limiter";
const DATE_KEY = "usage_date";
const COUNT_KEY = "usage_count";

export type UsageLimiterReserveResult = {
	ok: boolean;
	allowed: boolean;
	count: number;
	limit: number;
	date: string;
};

export const getUsageLimiterStub = (namespace: DurableObjectNamespace) =>
	namespace.get(namespace.idFromName(LIMITER_NAME));

export async function reserveUsageQueue(
	stub: { fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> },
	options: { limit: number; amount?: number },
): Promise<UsageLimiterReserveResult> {
	const limit = Math.max(0, Math.floor(options.limit));
	const amount = Math.max(1, Math.floor(options.amount ?? 1));
	const response = await stub.fetch("https://usage-limiter/reserve", {
		method: "POST",
		body: JSON.stringify({ limit, amount }),
	});
	if (!response.ok) {
		throw new Error(`usage_limiter_failed:${response.status}`);
	}
	const payload = (await response.json()) as UsageLimiterReserveResult;
	return payload;
}

export class UsageLimiter {
	private state: DurableObjectState;

	constructor(state: DurableObjectState) {
		this.state = state;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (request.method === "POST" && url.pathname === "/reserve") {
			let limit = 0;
			let amount = 1;
			try {
				const payload = (await request.json()) as {
					limit?: number;
					amount?: number;
				};
				limit = Math.max(0, Math.floor(Number(payload?.limit ?? 0)));
				amount = Math.max(1, Math.floor(Number(payload?.amount ?? 1)));
			} catch {
				return new Response("Invalid payload", { status: 400 });
			}
			const nowDate = beijingDateString(new Date());
			let storedDate =
				(await this.state.storage.get<string>(DATE_KEY)) ?? null;
			let count = (await this.state.storage.get<number>(COUNT_KEY)) ?? 0;
			if (storedDate !== nowDate) {
				storedDate = nowDate;
				count = 0;
			}
			const nextCount = count + amount;
			const allowed = limit <= 0 ? true : nextCount <= limit;
			if (allowed) {
				count = nextCount;
			}
			await this.state.storage.put({
				[DATE_KEY]: storedDate,
				[COUNT_KEY]: count,
			});
			return new Response(
				JSON.stringify({
					ok: true,
					allowed,
					count,
					limit,
					date: storedDate,
				}),
				{ headers: { "Content-Type": "application/json" } },
			);
		}
		if (request.method === "GET" && url.pathname === "/status") {
			const nowDate = beijingDateString(new Date());
			let storedDate =
				(await this.state.storage.get<string>(DATE_KEY)) ?? null;
			let count = (await this.state.storage.get<number>(COUNT_KEY)) ?? 0;
			if (storedDate !== nowDate) {
				storedDate = nowDate;
				count = 0;
			}
			return new Response(
				JSON.stringify({
					ok: true,
					date: storedDate,
					count,
				}),
				{ headers: { "Content-Type": "application/json" } },
			);
		}
		return new Response("Not Found", { status: 404 });
	}
}
