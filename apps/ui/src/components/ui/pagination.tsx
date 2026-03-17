import { Button } from "./button";
import { cx, type ClassName } from "./utils";

export type PaginationItem = number | "ellipsis";

export type PaginationProps = {
	page: number;
	totalPages: number;
	items: PaginationItem[];
	onPageChange: (next: number) => void;
	disabled?: boolean;
	class?: ClassName;
};

export const Pagination = ({
	page,
	totalPages,
	items,
	onPageChange,
	disabled,
	class: className,
}: PaginationProps) => {
	return (
		<div class={cx("app-pagination", className)}>
			<Button
				class="h-8 w-8 text-xs"
				size="sm"
				type="button"
				disabled={disabled || page <= 1}
				onClick={() => onPageChange(Math.max(1, page - 1))}
			>
				&lt;
			</Button>
			{items.map((item, index) =>
				item === "ellipsis" ? (
					<span
						class="px-2 text-xs text-[color:var(--app-ink-muted)]"
						key={`e-${index}`}
					>
						...
					</span>
				) : (
					<Button
						class={`h-8 min-w-8 px-3 text-xs ${
							item === page ? "app-button-primary" : ""
						}`}
						size="sm"
						type="button"
						key={item}
						disabled={disabled}
						onClick={() => onPageChange(item)}
					>
						{item}
					</Button>
				),
			)}
			<Button
				class="h-8 w-8 text-xs"
				size="sm"
				type="button"
				disabled={disabled || page >= totalPages}
				onClick={() => onPageChange(Math.min(totalPages, page + 1))}
			>
				&gt;
			</Button>
		</div>
	);
};
