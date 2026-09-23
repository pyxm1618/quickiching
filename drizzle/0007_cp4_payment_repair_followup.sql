-- 0005 rows did not have a canonical fingerprint or encrypted checkout URL.
-- Keep their exact raw payload hash as an immutable legacy marker. Runtime
-- duplicate handling uses the stored normalized payload plus this marker to
-- accept exact delivery retries while remaining fail-closed for ambiguity.
UPDATE payment_webhook_inbox
SET canonical_payload_sha256 = 'legacy:v1:' || payload_sha256
WHERE canonical_payload_sha256 IS NULL;--> statement-breakpoint
ALTER TABLE "payment_webhook_inbox" ALTER COLUMN "canonical_payload_sha256" SET NOT NULL;--> statement-breakpoint

-- A pre-0007 checkout URL contains a bearer token that cannot be safely
-- re-encrypted in SQL. Quarantine it before enabling the encrypted shape.
UPDATE payment_orders
SET status = 'financial_review', provider_checkout_session_id = null,
    provider_checkout_url = null, checkout_expires_at = null,
    checkout_error_code = 'CHECKOUT_LEGACY_TOKEN_REQUIRES_REAUTH',
    updated_at = clock_timestamp()
WHERE status = 'checkout_created'
  AND provider_checkout_url IS NOT NULL
  AND provider_checkout_url NOT LIKE 'enc:v1:%';--> statement-breakpoint

UPDATE payment_orders
SET provider_checkout_session_id = null, provider_checkout_url = null,
    checkout_expires_at = null, updated_at = clock_timestamp()
WHERE status <> 'checkout_created' AND provider_checkout_url IS NOT NULL;--> statement-breakpoint

ALTER TABLE "payment_orders" DROP CONSTRAINT "payment_orders_checkout_shape_check";--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_checkout_shape_check" CHECK ((
      "payment_orders"."status" = 'pending'
      or ("payment_orders"."status" = 'checkout_initializing' and "payment_orders"."checkout_claim_token" is not null and "payment_orders"."checkout_claim_expires_at" is not null)
      or ("payment_orders"."status" = 'checkout_created' and "payment_orders"."provider_checkout_session_id" is not null and "payment_orders"."provider_checkout_url" like 'enc:v1:%' and "payment_orders"."checkout_expires_at" is not null)
      or ("payment_orders"."status" = 'paid'
        and "payment_orders"."provider_order_id" is not null
        and "payment_orders"."provider_payment_id" is not null
        and "payment_orders"."paid_at" is not null
        and "payment_orders"."refunded_at" is null)
      or ("payment_orders"."status" = 'refunded'
        and "payment_orders"."provider_order_id" is not null
        and "payment_orders"."provider_payment_id" is not null
        and "payment_orders"."paid_at" is not null
        and "payment_orders"."refunded_at" is not null)
      or "payment_orders"."status" = 'financial_review'
    ));
--> statement-breakpoint

ALTER TABLE "payment_webhook_inbox"
  ADD CONSTRAINT "payment_inbox_canonical_hash_shape_check"
  CHECK ("canonical_payload_sha256" like 'legacy:v1:%' or "canonical_payload_sha256" ~ '^[a-f0-9]{64}$');--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_payment_inbox_identity_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.provider IS DISTINCT FROM OLD.provider
    OR NEW.provider_environment IS DISTINCT FROM OLD.provider_environment
    OR NEW.delivery_id IS DISTINCT FROM OLD.delivery_id
    OR NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.event_type IS DISTINCT FROM OLD.event_type
    OR NEW.store_id IS DISTINCT FROM OLD.store_id
    OR NEW.order_merchant_external_id IS DISTINCT FROM OLD.order_merchant_external_id
    OR NEW.payload_sha256 IS DISTINCT FROM OLD.payload_sha256
    OR NEW.canonical_payload_sha256 IS DISTINCT FROM OLD.canonical_payload_sha256
    OR NEW.normalized_payload IS DISTINCT FROM OLD.normalized_payload
    OR NEW.signature_verified_at IS DISTINCT FROM OLD.signature_verified_at
  THEN
    RAISE EXCEPTION 'IMMUTABLE_PAYMENT_INBOX_IDENTITY';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_payment_outbox_order_consistency()
RETURNS trigger AS $$
DECLARE
  inbox_order_id uuid;
BEGIN
  SELECT linked_order_id INTO inbox_order_id
  FROM payment_webhook_inbox WHERE id = NEW.inbox_id;
  IF NEW.order_id IS NULL AND inbox_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'PAYMENT_OUTBOX_INBOX_ORDER_MISMATCH';
  END IF;
  IF NEW.order_id IS NOT NULL AND (inbox_order_id IS NULL OR inbox_order_id IS DISTINCT FROM NEW.order_id) THEN
    RAISE EXCEPTION 'PAYMENT_OUTBOX_INBOX_ORDER_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_entitlement_ledger_associations()
RETURNS trigger AS $$
DECLARE
  batch_order_id uuid;
  inbox_order_id uuid;
BEGIN
  SELECT order_id INTO batch_order_id FROM entitlement_batches WHERE id = NEW.batch_id;
  IF batch_order_id IS NULL OR batch_order_id IS DISTINCT FROM NEW.order_id THEN
    RAISE EXCEPTION 'ENTITLEMENT_LEDGER_BATCH_ORDER_MISMATCH';
  END IF;
  IF NEW.webhook_inbox_id IS NOT NULL THEN
    SELECT linked_order_id INTO inbox_order_id
    FROM payment_webhook_inbox WHERE id = NEW.webhook_inbox_id;
    IF inbox_order_id IS NULL OR inbox_order_id IS DISTINCT FROM NEW.order_id THEN
      RAISE EXCEPTION 'ENTITLEMENT_LEDGER_INBOX_ORDER_MISMATCH';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_payment_inbox_associations()
RETURNS trigger AS $$
BEGIN
  IF NEW.linked_order_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM payment_outbox
      WHERE inbox_id = NEW.id AND order_id IS NOT NULL
    ) OR EXISTS (
      SELECT 1 FROM entitlement_ledger
      WHERE webhook_inbox_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'PAYMENT_INBOX_ASSOCIATION_MISMATCH';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM payment_outbox
      WHERE inbox_id = NEW.id AND (order_id IS NULL OR order_id IS DISTINCT FROM NEW.linked_order_id)
    ) OR EXISTS (
      SELECT 1 FROM entitlement_ledger
      WHERE webhook_inbox_id = NEW.id AND order_id IS DISTINCT FROM NEW.linked_order_id
    ) THEN
      RAISE EXCEPTION 'PAYMENT_INBOX_ASSOCIATION_MISMATCH';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM payment_outbox o
    JOIN payment_webhook_inbox i ON i.id = o.inbox_id
    WHERE o.order_id IS NOT NULL AND (i.linked_order_id IS NULL OR i.linked_order_id IS DISTINCT FROM o.order_id)
  ) OR EXISTS (
    SELECT 1 FROM entitlement_ledger l
    JOIN payment_webhook_inbox i ON i.id = l.webhook_inbox_id
    WHERE i.linked_order_id IS NULL OR i.linked_order_id IS DISTINCT FROM l.order_id
  ) THEN
    RAISE EXCEPTION 'CP4_PAYMENT_ASSOCIATION_DATA_INVALID';
  END IF;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS payment_outbox_order_consistency_trigger ON payment_outbox;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER payment_outbox_order_consistency_trigger
AFTER INSERT OR UPDATE OF inbox_id, order_id ON payment_outbox
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_payment_outbox_order_consistency();--> statement-breakpoint

DROP TRIGGER IF EXISTS payment_inbox_association_consistency_trigger ON payment_webhook_inbox;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER payment_inbox_association_consistency_trigger
AFTER INSERT OR UPDATE OF linked_order_id ON payment_webhook_inbox
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_payment_inbox_associations();--> statement-breakpoint
