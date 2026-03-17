import { useEffect, useMemo, useState } from "hono/jsx/dom";
import { Button } from "./button";
import { Popover, PopoverContent } from "./popover";
import { cx, type ClassName } from "./utils";

export type ColumnOption = {
	id: string;
	label: string;
	locked?: boolean;
	description?: string;
};

export type ColumnPickerProps = {
	label?: string;
	columns: ColumnOption[];
	value: string[];
	onChange: (next: string[]) => void;
	class?: ClassName;
};

export const ColumnPicker = ({
	label = "自定义列",
	columns,
	value,
	onChange,
	class: className,
}: ColumnPickerProps) => {
	const [open, setOpen] = useState(false);
	const instanceId = useMemo(
		() => `column-${Math.random().toString(36).slice(2)}`,
		[],
	);
	const popoverEvent = "app:popover-open";
	const visibleSet = useMemo(() => new Set(value), [value]);
	const toggleColumn = (column: ColumnOption) => {
		if (column.locked) {
			return;
		}
		const next = new Set(visibleSet);
		if (next.has(column.id)) {
			next.delete(column.id);
		} else {
			next.add(column.id);
		}
		const ordered = columns.map((item) => item.id).filter((id) => next.has(id));
		onChange(ordered);
	};
	useEffect(() => {
		const handlePopoverOpen = (event: Event) => {
			const detail = (event as CustomEvent<string>).detail;
			if (detail !== instanceId) {
				setOpen(false);
			}
		};
		window.addEventListener(popoverEvent, handlePopoverOpen);
		return () => {
			window.removeEventListener(popoverEvent, handlePopoverOpen);
		};
	}, [instanceId, popoverEvent]);

	return (
		<div class={cx("relative", className)}>
			<Button
				class="h-8 px-3 text-[11px]"
				size="sm"
				type="button"
				onClick={(event) => {
					event.stopPropagation();
					if (!open) {
						window.dispatchEvent(
							new CustomEvent<string>(popoverEvent, { detail: instanceId }),
						);
					}
					setOpen((prev) => !prev);
				}}
			>
				{label}
			</Button>
			<Popover open={open}>
				<PopoverContent class="right-0 w-64 p-3 app-popover-content--spaced">
					<div class="text-xs font-semibold uppercase tracking-widest text-[color:var(--app-ink-muted)]">
						显示列
					</div>
					<div class="mt-2 space-y-2 text-xs text-[color:var(--app-ink-muted)]">
						{columns.map((column) => (
							<label class="flex items-start gap-2" key={column.id}>
								<input
									checked={visibleSet.has(column.id)}
									class="mt-0.5 h-3.5 w-3.5 rounded border-[color:var(--app-border)] text-[color:var(--app-ink)] focus:ring-[color:var(--app-accent-soft)]"
									disabled={column.locked}
									type="checkbox"
									onChange={() => toggleColumn(column)}
								/>
								<span>
									<span class="text-[color:var(--app-ink)]">
										{column.label}
									</span>
									{column.description ? (
										<span class="mt-1 block text-[11px] text-[color:var(--app-ink-muted)]">
											{column.description}
										</span>
									) : null}
								</span>
							</label>
						))}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
};
