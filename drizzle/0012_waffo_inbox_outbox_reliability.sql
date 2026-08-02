-- Preserve historical Inbox rows while changing idempotency to Waffo's two identities.
UPDATE webhook_inbox
SET delivery_id = concat('legacy:', provider, ':', event_type, ':', event_id)
WHERE delivery_id IS NULL;

ALTER TABLE webhook_inbox DROP CONSTRAINT IF EXISTS webhook_inbox_pkey;
ALTER TABLE webhook_inbox ALTER COLUMN delivery_id SET NOT NULL;
ALTER TABLE webhook_inbox
  ADD CONSTRAINT webhook_inbox_pkey PRIMARY KEY (provider, delivery_id);

DROP INDEX IF EXISTS webhook_inbox_provider_delivery_once_idx;
CREATE UNIQUE INDEX webhook_inbox_provider_delivery_once_idx
  ON webhook_inbox (provider, delivery_id);
CREATE UNIQUE INDEX IF NOT EXISTS webhook_inbox_provider_event_once_idx
  ON webhook_inbox (provider, event_type, event_id);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS provider_subtotal_minor integer,
  ADD COLUMN IF NOT EXISTS provider_tax_amount_minor integer,
  ADD COLUMN IF NOT EXISTS provider_total_minor integer;

CREATE UNIQUE INDEX IF NOT EXISTS outbox_payment_delivery_once_idx
  ON outbox (topic, aggregate_id) WHERE topic = 'payment.webhook.received';
