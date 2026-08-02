ALTER TABLE webhook_inbox ADD COLUMN IF NOT EXISTS delivery_id text;
ALTER TABLE webhook_inbox ADD COLUMN IF NOT EXISTS mode text;
ALTER TABLE webhook_inbox ADD COLUMN IF NOT EXISTS store_id text;
ALTER TABLE webhook_inbox ADD COLUMN IF NOT EXISTS order_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_email_snapshot text;

CREATE UNIQUE INDEX IF NOT EXISTS webhook_inbox_provider_delivery_once_idx
  ON webhook_inbox (provider, delivery_id) WHERE delivery_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS webhook_inbox_provider_event_once_idx
  ON webhook_inbox (provider, event_type, event_id);
CREATE INDEX IF NOT EXISTS webhook_inbox_unprocessed_waffo_idx
  ON webhook_inbox (provider, created_at) WHERE processed_at IS NULL;

ALTER TABLE webhook_inbox DROP CONSTRAINT IF EXISTS webhook_inbox_pkey;
ALTER TABLE webhook_inbox ADD CONSTRAINT webhook_inbox_pkey PRIMARY KEY (provider, event_id);
