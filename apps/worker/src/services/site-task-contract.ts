import type { ChannelTokenTestItem, ChannelTokenTestSummary } from "./channel-testing";
import type { CheckinResultItem } from "./checkin";

export type SiteTaskToken = {
	id?: string;
	name?: string;
	api_key: string;
};

export type SiteTaskTestRequest = {
	base_url: string;
	tokens: SiteTaskToken[];
};

export type SiteTaskTestResponse = ChannelTokenTestSummary;

export type SiteTaskCheckinTarget = {
	id: string;
	name: string;
	base_url: string;
	checkin_url?: string | null;
	system_token?: string | null;
	system_userid?: string | null;
};

export type SiteTaskCheckinRequest = {
	site: SiteTaskCheckinTarget;
};

export type SiteTaskCheckinResponse = {
	result: CheckinResultItem;
};

export type SiteTaskProbeChannel = {
	id: string;
	name: string;
	base_url: string;
	api_key: string;
};

export type SiteTaskProbeResult = {
	attempted: boolean;
	recovered: boolean;
	reason:
		| "recovered"
		| "already_active"
		| "no_disabled_channel"
		| "missing_token"
		| "token_model_test_failed"
		| "completion_probe_failed";
	channel_id?: string;
	channel_name?: string;
	model?: string;
	elapsed: number;
	models: string[];
	items: ChannelTokenTestItem[];
};

export type SiteTaskProbeRequest = {
	channel: SiteTaskProbeChannel;
	tokens: SiteTaskToken[];
};

export type SiteTaskProbeResponse = {
	result: SiteTaskProbeResult;
};
