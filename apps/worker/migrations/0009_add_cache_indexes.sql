CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_channel_id ON usage_logs (channel_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_token_id ON usage_logs (token_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_model ON usage_logs (model);
CREATE INDEX IF NOT EXISTS idx_usage_logs_status ON usage_logs (status);
CREATE INDEX IF NOT EXISTS idx_usage_logs_upstream_status ON usage_logs (upstream_status);

CREATE INDEX IF NOT EXISTS idx_channel_model_capabilities_channel_ok
ON channel_model_capabilities (channel_id, last_ok_at);

CREATE INDEX IF NOT EXISTS idx_channel_model_capabilities_model_err
ON channel_model_capabilities (model, last_err_at);

CREATE INDEX IF NOT EXISTS idx_channel_call_tokens_channel_id
ON channel_call_tokens (channel_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_key_hash
ON tokens (key_hash);
