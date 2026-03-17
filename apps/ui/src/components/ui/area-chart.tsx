import { useMemo, useState } from "hono/jsx/dom";
import { cx, type ClassName } from "./utils";

export type AreaChartPoint = {
	label: string;
	value: number;
	secondary?: number;
};

export type AreaChartProps = {
	data: AreaChartPoint[];
	height?: number;
	valueLabel?: string;
	secondaryLabel?: string;
	class?: ClassName;
};

export const AreaChart = ({
	data,
	height = 180,
	valueLabel = "请求",
	secondaryLabel = "Tokens",
	class: className,
}: AreaChartProps) => {
	const [activeIndex, setActiveIndex] = useState<number | null>(null);
	const points = useMemo(() => {
		if (data.length === 0) {
			return [];
		}
		const maxValue = Math.max(...data.map((item) => item.value), 1);
		return data.map((item, index) => {
			const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
			const y = 100 - (item.value / maxValue) * 100;
			return { ...item, x, y };
		});
	}, [data]);
	const linePath = useMemo(() => {
		if (points.length === 0) {
			return "";
		}
		return points
			.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
			.join(" ");
	}, [points]);
	const areaPath = linePath ? `${linePath} L 100 100 L 0 100 Z` : "";
	const activePoint =
		activeIndex !== null && points[activeIndex] ? points[activeIndex] : null;

	const handleMouseMove = (event: MouseEvent) => {
		if (points.length === 0) {
			return;
		}
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const ratio = rect.width ? (event.clientX - rect.left) / rect.width : 0;
		const index = Math.min(
			points.length - 1,
			Math.max(0, Math.round(ratio * (points.length - 1))),
		);
		setActiveIndex(index);
	};

	return (
		<div class={cx("relative", className)}>
			{points.length === 0 ? (
				<div class="flex h-full items-center justify-center text-sm text-[color:var(--app-ink-muted)]">
					暂无趋势数据
				</div>
			) : (
				<div class="relative w-full" style={`height:${height}px`}>
					<svg
						viewBox="0 0 100 100"
						class="h-full w-full"
						role="img"
						aria-label={`${valueLabel}趋势`}
						onMouseLeave={() => setActiveIndex(null)}
						onMouseMove={handleMouseMove}
					>
						<defs>
							<linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
								<stop offset="0%" stopColor="rgba(10,132,255,0.35)" />
								<stop offset="100%" stopColor="rgba(10,132,255,0.02)" />
							</linearGradient>
						</defs>
						<path d={areaPath} fill="url(#areaGradient)" />
						<path
							d={linePath}
							fill="none"
							stroke="rgba(10,132,255,0.9)"
							strokeWidth="1.8"
						/>
						{activePoint ? (
							<circle
								cx={activePoint.x}
								cy={activePoint.y}
								r="2.5"
								fill="#0a84ff"
							/>
						) : null}
					</svg>
					{activePoint ? (
						<div
							class="pointer-events-none absolute top-2 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-xs text-[color:var(--app-ink)] shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
							style={`left: ${activePoint.x}%; transform: translateX(-50%);`}
						>
							<div class="text-[11px] text-[color:var(--app-ink-muted)]">
								{activePoint.label}
							</div>
							<div class="mt-1 font-semibold">
								{valueLabel}: {activePoint.value}
							</div>
							{activePoint.secondary !== undefined ? (
								<div class="text-[11px] text-[color:var(--app-ink-muted)]">
									{secondaryLabel}: {activePoint.secondary}
								</div>
							) : null}
						</div>
					) : null}
				</div>
			)}
		</div>
	);
};
