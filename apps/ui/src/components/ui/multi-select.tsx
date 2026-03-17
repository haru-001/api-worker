import { useEffect, useMemo, useState } from "hono/jsx/dom";
import { Input } from "./input";
import { PopoverContent } from "./popover";
import { cx, type ClassName } from "./utils";

export type MultiSelectOption = {
	value: string;
	label: string;
};

export type MultiSelectProps = {
	options: MultiSelectOption[];
	value: string[];
	onChange: (next: string[]) => void;
	placeholder?: string;
	searchPlaceholder?: string;
	emptyLabel?: string;
	class?: ClassName;
};

export const MultiSelect = ({
	options,
	value,
	onChange,
	placeholder = "请选择",
	searchPlaceholder = "搜索",
	emptyLabel = "暂无选项",
	class: className,
}: MultiSelectProps) => {
	const [open, setOpen] = useState(false);
	const instanceId = useMemo(
		() => `multi-${Math.random().toString(36).slice(2)}`,
		[],
	);
	const popoverEvent = "app:popover-open";
	const [search, setSearch] = useState("");
	const valueSet = useMemo(() => new Set(value), [value]);
	const selectedLabels = useMemo(
		() =>
			options
				.filter((option) => valueSet.has(option.value))
				.map((option) => option.label),
		[options, valueSet],
	);
	const summary =
		selectedLabels.length === 0
			? placeholder
			: selectedLabels.length <= 2
				? selectedLabels.join(", ")
				: `${selectedLabels.slice(0, 2).join(", ")} +${
						selectedLabels.length - 2
					}`;
	const filteredOptions = useMemo(() => {
		const keyword = search.trim().toLowerCase();
		if (!keyword) {
			return options;
		}
		return options.filter((option) => {
			const label = option.label.toLowerCase();
			const valueText = option.value.toLowerCase();
			return label.includes(keyword) || valueText.includes(keyword);
		});
	}, [options, search]);
	const toggleValue = (option: MultiSelectOption) => {
		const next = new Set(valueSet);
		if (next.has(option.value)) {
			next.delete(option.value);
		} else {
			next.add(option.value);
		}
		const ordered = options
			.map((item) => item.value)
			.filter((item) => next.has(item));
		onChange(ordered);
	};
	const clearAll = () => onChange([]);
	useEffect(() => {
		const handleGlobalOpen = (event: Event) => {
			const detail = (event as CustomEvent<string>).detail;
			if (detail !== instanceId) {
				setOpen(false);
			}
		};
		window.addEventListener(popoverEvent, handleGlobalOpen);
		return () => {
			window.removeEventListener(popoverEvent, handleGlobalOpen);
		};
	}, [instanceId, popoverEvent]);
	useEffect(() => {
		if (!open) {
			return;
		}
		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as HTMLElement | null;
			if (!target) {
				return;
			}
			if (target.closest(".app-multi-select-root")) {
				return;
			}
			setOpen(false);
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				setOpen(false);
			}
		};
		window.addEventListener("pointerdown", handlePointerDown);
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [open]);

	return (
		<div
			class={cx(
				"app-multi-select-root",
				open && "app-multi-select-root--open",
				className,
			)}
		>
			<button
				aria-expanded={open}
				class={cx("app-multi-select app-focus", open && "app-multi-select--open")}
				type="button"
				onClick={(event) => {
					event.stopPropagation();
					if (!open) {
						window.dispatchEvent(
							new CustomEvent<string>(popoverEvent, {
								detail: instanceId,
							}),
						);
					}
					setOpen((prev) => !prev);
				}}
			>
				<span
					class={cx(
						"app-multi-select__value",
						selectedLabels.length === 0 && "app-multi-select__placeholder",
					)}
				>
					{summary}
				</span>
				{selectedLabels.length > 0 && (
					<span class="app-multi-select__count">{selectedLabels.length}</span>
				)}
				<span aria-hidden="true" class="app-multi-select__chevron">
					▾
				</span>
			</button>
			{open ? (
				<PopoverContent
					class="app-popover-content--full p-3"
					onPointerDown={(event) => event.stopPropagation()}
				>
					<Input
						class="h-8 text-xs"
						placeholder={searchPlaceholder}
						value={search}
						onInput={(event) =>
							setSearch((event.currentTarget as HTMLInputElement).value)
						}
					/>
					<div class="mt-2 flex items-center justify-between text-[11px] text-[color:var(--app-ink-muted)]">
						<span>已选 {selectedLabels.length}</span>
						{selectedLabels.length > 0 ? (
							<button
								class="text-[11px] font-semibold text-[color:var(--app-ink-muted)] transition-colors hover:text-[color:var(--app-ink)]"
								type="button"
								onClick={clearAll}
							>
								清空
							</button>
						) : null}
					</div>
					<div class="mt-2 max-h-48 space-y-1 overflow-auto">
						{filteredOptions.length === 0 ? (
							<div class="px-2 py-3 text-xs text-[color:var(--app-ink-muted)]">
								{emptyLabel}
							</div>
						) : (
							filteredOptions.map((option) => {
								const selected = valueSet.has(option.value);
								return (
									<button
										class={cx(
											"app-multi-option",
											selected && "app-multi-option--selected",
										)}
										key={option.value}
										type="button"
										onClick={() => toggleValue(option)}
									>
										<span class="truncate">{option.label}</span>
										{selected ? (
											<span class="app-multi-option__check">✓</span>
										) : null}
									</button>
								);
							})
						)}
					</div>
				</PopoverContent>
			) : null}
		</div>
	);
};
