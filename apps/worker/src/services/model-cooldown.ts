function normalizeCooldownCode(value: string | null): string {
	if (!value) {
		return "";
	}
	return value.trim().toLowerCase();
}

export function shouldCooldown(
	upstreamStatus: number | null,
	errorCode: string | null,
): boolean {
	if (upstreamStatus !== null && upstreamStatus !== 200) {
		return true;
	}
	if (normalizeCooldownCode(errorCode).length > 0) {
		return true;
	}
	return false;
}
