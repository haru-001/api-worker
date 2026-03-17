export type ClassName = string | false | null | undefined;
type ClassInput = ClassName | Promise<string>;

export const cx = (...classes: ClassInput[]) =>
	classes
		.filter((value): value is string => typeof value === "string" && value.length > 0)
		.join(" ");
