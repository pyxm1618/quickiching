ALTER TABLE outbox
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_code text;
CREATE INDEX IF NOT EXISTS outbox_payment_dead_letter_idx
  ON outbox (topic, dead_lettered_at) WHERE topic = 'payment.webhook.received' AND dead_lettered_at IS NOT NULL;
