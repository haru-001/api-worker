import type { EndpointType, ProviderType } from "./provider-transform";
import type { NormalizedUsage } from "../utils/usage";

export const SUCCESSFUL_ZERO_USAGE_WARNING_CODE = "usage_zero_tokens";

export function shouldValidateToolSchemasFromRequestText(
	provider: ProviderType,
	requestText: string,
): boolean {
	if (provider !== "openai") {
		return false;
	}
	return /"tools"\s*:/u.test(requestText);
}

export function getSuccessfulUsageWarning(options: {
	isStream: boolean;
	endpointType: EndpointType;
	usage: NormalizedUsage | null;
}): { code: string; message: string } | null {
	if (!options.isStream) {
		return null;
	}
	if (options.endpointType !== "chat" && options.endpointType !== "responses") {
		return null;
	}
	if (!options.usage) {
		return null;
	}
	if (
		options.usage.totalTokens === 0 &&
		options.usage.promptTokens === 0 &&
		options.usage.completionTokens === 0
	) {
		return {
			code: SUCCESSFUL_ZERO_USAGE_WARNING_CODE,
			message:
				"usage_zero_tokens: total_tokens=0, prompt_tokens=0, completion_tokens=0",
		};
	}
	return null;
}
