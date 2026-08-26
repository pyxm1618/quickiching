-- 0005/0006 allowed an Outbox row with a NULL order_id even when its Inbox
-- had already been linked. 0007 correctly rejects new writes of that shape,
-- but constraint triggers do not validate historical rows. Backfill the only
-- unambiguous direction from the Inbox owner before validating the full set.
UPDATE payment_outbox o
SET order_id = i.linked_order_id,
    updated_at = clock_timestamp()
FROM payment_webhook_inbox i
WHERE i.id = o.inbox_id
  AND o.order_id IS NULL
  AND i.linked_order_id IS NOT NULL;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM payment_outbox o
    JOIN payment_webhook_inbox i ON i.id = o.inbox_id
    WHERE o.order_id IS DISTINCT FROM i.linked_order_id
  ) OR EXISTS (
    SELECT 1 FROM entitlement_ledger l
    JOIN payment_webhook_inbox i ON i.id = l.webhook_inbox_id
    WHERE i.linked_order_id IS DISTINCT FROM l.order_id
  ) THEN
    RAISE EXCEPTION 'CP4_PAYMENT_ASSOCIATION_DATA_INVALID';
  END IF;
END
$$;
