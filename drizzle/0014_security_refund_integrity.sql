ALTER TABLE entitlement_batches
  ADD COLUMN refund_locked boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE refund_intents
  ADD COLUMN decision_operator_id text,
  ADD COLUMN dispatch_operator_id text;
--> statement-breakpoint
UPDATE entitlement_batches AS b
SET refund_locked = true,
    updated_at = clock_timestamp()
FROM refund_intents AS r
WHERE r.order_id = b.order_id
  AND r.provider_write_attempt_count = 1
  AND r.provider_write_state IN ('dispatched', 'confirmed', 'ambiguous')
  AND r.status IN ('processing', 'reconciliation_required')
  AND b.quantity_revoked < b.quantity_total;
