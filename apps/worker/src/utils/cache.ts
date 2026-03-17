import type { Context } from "hono";
import type { AppEnv } from "../env";
import { sha256Hex } from "./crypto";
import { getBearerToken } from "./request";

export type CacheNamespace =
	| "usage"
	| "dashboard"
	| "models"
	| "tokens"
	| "channels"
	| "call_tokens"
	| "settings";

export type ApiCacheOptions = {
	namespace: CacheNamespace;
	version: number;
	ttlSeconds: number;
	enabled: boolean;
};

const CACHE_HEADER = "X-Cache";
const INTERNAL_CACHE_ORIGIN = "https://cache.internal";

type CacheStore = {
	default: Cache;
};

function getCacheStorage(): Cache | null {
	const storage = (globalThis as unknown as { caches?: CacheStore }).caches;
	return storage?.default ?? null;
}

async function buildCacheKey(
	c: Context<AppEnv>,
	namespace: CacheNamespace,
	version: number,
): Promise<Request> {
	const url = new URL(c.req.url);
	const token = getBearerToken(c);
	const authHash = token ? await sha256Hex(token) : "anonymous";
	const entries = Array.from(url.searchParams.entries());
	entries.push(["__cache_ns", namespace]);
	entries.push(["__cache_v", String(version)]);
	entries.push(["__cache_ah", authHash]);
	entries.sort((a, b) => {
		const keyCompare = a[0].localeCompare(b[0]);
		return keyCompare !== 0 ? keyCompare : a[1].localeCompare(b[1]);
	});
	url.search = new URLSearchParams(entries).toString();
	return new Request(url.toString(), { method: "GET" });
}

function normalizeTtlSeconds(value: number): number {
	if (!Number.isFinite(value) || value <= 0) {
		return 0;
	}
	return Math.floor(value);
}

function buildInternalCacheRequest(
	namespace: CacheNamespace,
	key: string,
	version: number,
): Request {
	const safeKey = encodeURIComponent(key);
	const url = new URL(`${INTERNAL_CACHE_ORIGIN}/${namespace}/${safeKey}`);
	url.searchParams.set("v", String(version));
	return new Request(url.toString(), { method: "GET" });
}

export async function withJsonCache<T>(
	options: ApiCacheOptions & { key: string; cacheNull?: boolean },
	loader: () => Promise<T>,
): Promise<T> {
	const ttlSeconds = normalizeTtlSeconds(options.ttlSeconds);
	if (!options.enabled || ttlSeconds <= 0) {
		return loader();
	}
	const cache = getCacheStorage();
	if (!cache) {
		return loader();
	}
	const cacheKey = buildInternalCacheRequest(
		options.namespace,
		options.key,
		options.version,
	);
	const cached = await cache.match(cacheKey);
	if (cached) {
		return (await cached.json()) as T;
	}
	const value = await loader();
	if (value !== null || options.cacheNull) {
		const headers = new Headers({ "Cache-Control": `max-age=${ttlSeconds}` });
		const response = new Response(JSON.stringify(value), { headers });
		await cache.put(cacheKey, response);
	}
	return value;
}

export async function withApiCache(
	c: Context<AppEnv>,
	options: ApiCacheOptions,
	handler: () => Promise<Response>,
): Promise<Response> {
	const ttlSeconds = normalizeTtlSeconds(options.ttlSeconds);
	if (!options.enabled || ttlSeconds <= 0 || c.req.method !== "GET") {
		return handler();
	}
	const cache = getCacheStorage();
	if (!cache) {
		return handler();
	}
	const cacheKey = await buildCacheKey(c, options.namespace, options.version);
	const cached = await cache.match(cacheKey);
	if (cached) {
		const response = new Response(cached.body, cached);
		response.headers.set(CACHE_HEADER, "HIT");
		return response;
	}

	const response = await handler();
	if (!response.ok) {
		return response;
	}
	const headers = new Headers(response.headers);
	headers.set("Cache-Control", `max-age=${ttlSeconds}`);
	headers.set(CACHE_HEADER, "MISS");
	const responseForClient = new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
	await cache.put(cacheKey, responseForClient.clone());
	return responseForClient;
}
