import { Button, Card, Input, Select, Switch } from "../components/ui";
import type { CacheConfig, RuntimeProxyConfig, SettingsForm } from "../core/types";

type SettingsViewProps = {
	settingsForm: SettingsForm;
	adminPasswordSet: boolean;
	isSaving: boolean;
	cacheConfig?: CacheConfig | null;
	isRefreshingCache?: boolean;
	runtimeConfig?: RuntimeProxyConfig | null;
	onSubmit: (event: Event) => void;
	onFormChange: (patch: Partial<SettingsForm>) => void;
	onRefreshCache: () => void;
};

/**
 * Renders the settings view.
 *
 * Args:
 *   props: Settings view props.
 *
 * Returns:
 *   Settings JSX element.
 */
export const SettingsView = ({
	settingsForm,
	adminPasswordSet,
	isSaving,
	cacheConfig,
	isRefreshingCache,
	runtimeConfig,
	onSubmit,
	onFormChange,
	onRefreshCache,
}: SettingsViewProps) => {
	const runtimeItems = [
		{
			label: "上游超时（毫秒）",
			value: runtimeConfig?.upstream_timeout_ms ?? 30000,
			env: "PROXY_UPSTREAM_TIMEOUT_MS",
		},
		{
			label: "流式 usage 解析模式",
			value: runtimeConfig?.stream_usage_mode ?? "full",
			env: "PROXY_STREAM_USAGE_MODE",
		},
		{
			label: "流式解析最大字节",
			value: runtimeConfig?.stream_usage_max_bytes ?? 0,
			env: "PROXY_STREAM_USAGE_MAX_BYTES",
		},
		{
			label: "流式解析并发上限",
			value: runtimeConfig?.stream_usage_max_parsers ?? 0,
			env: "PROXY_STREAM_USAGE_MAX_PARSERS",
		},
		{
			label: "队列开关",
			value: runtimeConfig?.usage_queue_enabled ? "启用" : "关闭",
			env: "PROXY_USAGE_QUEUE_ENABLED",
		},
		{
			label: "队列日限额",
			value: runtimeConfig?.usage_queue_daily_limit ?? 10000,
			env: "usage_queue_daily_limit",
		},
		{
			label: "直写比例",
			value:
				runtimeConfig?.usage_queue_direct_write_ratio !== undefined
					? `${Math.round(runtimeConfig.usage_queue_direct_write_ratio * 100)}%`
					: "50%",
			env: "usage_queue_direct_write_ratio",
		},
		{
			label: "队列绑定",
			value: runtimeConfig?.usage_queue_bound ? "已绑定" : "未绑定",
			env: "USAGE_QUEUE 绑定",
		},
		{
			label: "队列实际生效",
			value: runtimeConfig?.usage_queue_active ? "是" : "否",
			env: "USAGE_QUEUE 运行时",
		},
	];

	return (
		<div class="animate-fade-up space-y-4">
			<div class="flex items-center justify-between">
				<h3 class="app-title text-lg">系统设置</h3>
			</div>
			<Card class="p-5">
				<form class="grid gap-3.5 lg:grid-cols-2" onSubmit={onSubmit}>
					<div>
						<label
							class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="retention"
					>
						日志保留天数
					</label>
					<Input
						id="retention"
						name="log_retention_days"
						type="number"
						min="1"
						value={settingsForm.log_retention_days}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								log_retention_days: target?.value ?? "",
							});
						}}
					/>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="session-ttl"
					>
						会话时长（小时）
					</label>
					<Input
						id="session-ttl"
						name="session_ttl_hours"
						type="number"
						min="1"
						value={settingsForm.session_ttl_hours}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								session_ttl_hours: target?.value ?? "",
							});
						}}
					/>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="checkin-schedule-time"
					>
						签到时间（中国时间）
					</label>
					<Input
						id="checkin-schedule-time"
						name="checkin_schedule_time"
						type="time"
						value={settingsForm.checkin_schedule_time}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								checkin_schedule_time: target?.value ?? "",
							});
						}}
					/>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="failure-cooldown"
					>
						失败冷却（分钟）
					</label>
					<Input
						id="failure-cooldown"
						name="model_failure_cooldown_minutes"
						type="number"
						min="1"
						value={settingsForm.model_failure_cooldown_minutes}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								model_failure_cooldown_minutes: target?.value ?? "",
							});
						}}
					/>
					<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
						同一模型失败后在该时间内跳过对应渠道。
					</p>
				</div>
				<div class="lg:col-span-2">
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="admin-password"
					>
						管理员密码
					</label>
					<Input
						id="admin-password"
						name="admin_password"
						type="password"
						placeholder={
							adminPasswordSet
								? "已设置，留空则不修改"
								: "未设置，保存后即为登录密码"
						}
						value={settingsForm.admin_password}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								admin_password: target?.value ?? "",
							});
						}}
					/>
					<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
						密码状态：{adminPasswordSet ? "已设置" : "未设置"}
					</p>
				</div>
				<div class="lg:col-span-2">
					<div class="app-title text-sm">运行时配置</div>
					<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
						以下配置可在后台修改，环境变量仅作为回退值。
					</p>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="proxy-upstream-timeout"
					>
						上游超时（毫秒）
					</label>
					<Input
						id="proxy-upstream-timeout"
						name="proxy_upstream_timeout_ms"
						type="number"
						min="0"
						value={settingsForm.proxy_upstream_timeout_ms}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								proxy_upstream_timeout_ms: target?.value ?? "",
							});
						}}
					/>
					<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
						设置为 0 表示不限制超时。
					</p>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="proxy-stream-usage-mode"
					>
						流式 usage 解析模式
					</label>
					<Select
						id="proxy-stream-usage-mode"
						name="proxy_stream_usage_mode"
						value={settingsForm.proxy_stream_usage_mode}
						onChange={(event) => {
							const target = event.currentTarget as HTMLSelectElement | null;
							onFormChange({
								proxy_stream_usage_mode: target?.value ?? "full",
							});
						}}
					>
						<option value="full">full（完整解析）</option>
						<option value="lite">lite（轻量解析）</option>
						<option value="off">off（关闭解析）</option>
					</Select>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="proxy-stream-usage-max-bytes"
					>
						流式解析最大字节
					</label>
					<Input
						id="proxy-stream-usage-max-bytes"
						name="proxy_stream_usage_max_bytes"
						type="number"
						min="0"
						value={settingsForm.proxy_stream_usage_max_bytes}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								proxy_stream_usage_max_bytes: target?.value ?? "",
							});
						}}
					/>
					<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
						0 表示不限制。
					</p>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="proxy-stream-usage-max-parsers"
					>
						流式解析并发上限
					</label>
					<Input
						id="proxy-stream-usage-max-parsers"
						name="proxy_stream_usage_max_parsers"
						type="number"
						min="0"
						value={settingsForm.proxy_stream_usage_max_parsers}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								proxy_stream_usage_max_parsers: target?.value ?? "",
							});
						}}
					/>
					<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
						0 表示不限制。
					</p>
				</div>
				<div class="lg:col-span-2">
					<div class="flex items-center justify-between rounded-xl border border-white/70 bg-white/70 px-3 py-3">
						<div>
							<div class="text-sm font-semibold text-[color:var(--app-ink)]">
								启用用量队列
							</div>
							<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
								启用后将按比例把 usage 写入队列。
							</p>
						</div>
						<Switch
							checked={settingsForm.proxy_usage_queue_enabled}
							onToggle={(next) => {
								onFormChange({ proxy_usage_queue_enabled: next });
							}}
						/>
					</div>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="usage-queue-daily-limit"
					>
						队列日限额
					</label>
					<Input
						id="usage-queue-daily-limit"
						name="usage_queue_daily_limit"
						type="number"
						min="0"
						value={settingsForm.usage_queue_daily_limit}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								usage_queue_daily_limit: target?.value ?? "",
							});
						}}
					/>
					<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
						达到上限后自动切回 Worker 直写。
					</p>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="usage-queue-direct-ratio"
					>
						直写比例（0-1）
					</label>
					<Input
						id="usage-queue-direct-ratio"
						name="usage_queue_direct_write_ratio"
						type="number"
						min="0"
						max="1"
						step="0.01"
						value={settingsForm.usage_queue_direct_write_ratio}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								usage_queue_direct_write_ratio: target?.value ?? "",
							});
						}}
					/>
					<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
						示例：0.5 表示 50% 直写。
					</p>
				</div>
				<div class="lg:col-span-2">
					<div class="flex items-center justify-between rounded-xl border border-white/70 bg-white/70 px-3 py-3">
						<div>
							<div class="text-sm font-semibold text-[color:var(--app-ink)]">
								启用面板缓存
							</div>
							<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
								对数据面板、日志列表与模型列表启用短时缓存，降低 D1 读取量。
							</p>
						</div>
						<Switch
							checked={settingsForm.cache_enabled}
							onToggle={(next) => {
								onFormChange({ cache_enabled: next });
							}}
						/>
					</div>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="cache-dashboard-ttl"
					>
						面板缓存 TTL（秒）
					</label>
					<Input
						id="cache-dashboard-ttl"
						name="cache_ttl_dashboard_seconds"
						type="number"
						min="0"
						value={settingsForm.cache_ttl_dashboard_seconds}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								cache_ttl_dashboard_seconds: target?.value ?? "",
							});
						}}
					/>
					<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
						0 表示关闭该接口缓存。
					</p>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="cache-usage-ttl"
					>
						日志缓存 TTL（秒）
					</label>
					<Input
						id="cache-usage-ttl"
						name="cache_ttl_usage_seconds"
						type="number"
						min="0"
						value={settingsForm.cache_ttl_usage_seconds}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								cache_ttl_usage_seconds: target?.value ?? "",
							});
						}}
					/>
					<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
						日志查询建议设置较短 TTL。
					</p>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="cache-models-ttl"
					>
						模型缓存 TTL（秒）
					</label>
					<Input
						id="cache-models-ttl"
						name="cache_ttl_models_seconds"
						type="number"
						min="0"
						value={settingsForm.cache_ttl_models_seconds}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								cache_ttl_models_seconds: target?.value ?? "",
							});
						}}
					/>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="cache-tokens-ttl"
					>
						Token 鉴权缓存 TTL（秒）
					</label>
					<Input
						id="cache-tokens-ttl"
						name="cache_ttl_tokens_seconds"
						type="number"
						min="0"
						value={settingsForm.cache_ttl_tokens_seconds}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								cache_ttl_tokens_seconds: target?.value ?? "",
							});
						}}
					/>
					<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
						禁用令牌会自动失效，不影响即时生效。
					</p>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="cache-channels-ttl"
					>
						渠道缓存 TTL（秒）
					</label>
					<Input
						id="cache-channels-ttl"
						name="cache_ttl_channels_seconds"
						type="number"
						min="0"
						value={settingsForm.cache_ttl_channels_seconds}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								cache_ttl_channels_seconds: target?.value ?? "",
							});
						}}
					/>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="cache-call-tokens-ttl"
					>
						调用令牌缓存 TTL（秒）
					</label>
					<Input
						id="cache-call-tokens-ttl"
						name="cache_ttl_call_tokens_seconds"
						type="number"
						min="0"
						value={settingsForm.cache_ttl_call_tokens_seconds}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								cache_ttl_call_tokens_seconds: target?.value ?? "",
							});
						}}
					/>
				</div>
				<div>
					<label
						class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
						for="cache-settings-ttl"
					>
						设置缓存 TTL（秒）
					</label>
					<Input
						id="cache-settings-ttl"
						name="cache_ttl_settings_seconds"
						type="number"
						min="0"
						value={settingsForm.cache_ttl_settings_seconds}
						onInput={(event) => {
							const target = event.currentTarget as HTMLInputElement | null;
							onFormChange({
								cache_ttl_settings_seconds: target?.value ?? "",
							});
						}}
					/>
				</div>
				<div class="flex items-end justify-between lg:col-span-2">
					<div class="text-xs text-[color:var(--app-ink-muted)]">
						缓存版本：
						{cacheConfig
							? `tokens ${cacheConfig.version_tokens}, channels ${cacheConfig.version_channels}, call_tokens ${cacheConfig.version_call_tokens}, models ${cacheConfig.version_models}, dashboard ${cacheConfig.version_dashboard}, usage ${cacheConfig.version_usage}, settings ${cacheConfig.version_settings}`
							: "-"}
					</div>
					<Button
						variant="ghost"
						size="sm"
						type="button"
						disabled={isRefreshingCache}
						onClick={onRefreshCache}
					>
						{isRefreshingCache ? "刷新中..." : "刷新缓存"}
					</Button>
				</div>
				<div class="flex items-end lg:col-span-2">
					<Button variant="primary" size="lg" type="submit" disabled={isSaving}>
						{isSaving ? "保存中..." : "保存设置"}
					</Button>
				</div>
				</form>
			</Card>
			<Card class="p-5">
				<h4 class="app-title text-base">运行时配置（只读）</h4>
				<p class="mt-2 text-xs text-[color:var(--app-ink-muted)]">
					此处展示实际生效值（设置优先，环境变量作为回退）。
					环境变量名已在每项卡片内标注。
				</p>
				<div class="mt-3 grid gap-2 sm:grid-cols-2">
					{runtimeItems.map((item) => (
						<div class="rounded-xl border border-white/60 bg-white/70 px-3 py-3 text-sm">
							<div class="text-sm font-semibold text-[color:var(--app-ink)]">
								{item.label}
							</div>
							<div class="mt-1 text-[11px] font-mono text-[color:var(--app-ink-muted)]">
								{item.env}
							</div>
							<div class="mt-2 text-base font-semibold text-[color:var(--app-ink)]">
								{item.value}
							</div>
						</div>
					))}
				</div>
			</Card>
		</div>
	);
};
