ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'partially_refunded';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS provider_order_id text,
  ADD COLUMN IF NOT EXISTS provider_transaction_id text,
  ADD COLUMN IF NOT EXISTS provider_amount_minor integer,
  ADD COLUMN IF NOT EXISTS refunded_amount_minor integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_review_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_provider_event_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_order_once_idx
  ON orders (provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_transaction_once_idx
  ON orders (provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_provider_amount_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_provider_amount_check
      CHECK (provider_amount_minor IS NULL OR provider_amount_minor >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_refunded_amount_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_refunded_amount_check
      CHECK (refunded_amount_minor >= 0);
  END IF;
END
$$;

ALTER TABLE entitlement_batches
  ADD COLUMN IF NOT EXISTS order_id text;
CREATE UNIQUE INDEX IF NOT EXISTS entitlement_batches_order_once_idx
  ON entitlement_batches (order_id) WHERE order_id IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entitlement_batches_order_fk'
  ) THEN
    ALTER TABLE entitlement_batches ADD CONSTRAINT entitlement_batches_order_fk
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
  END IF;
END
$$;

ALTER TABLE entitlement_ledger
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS webhook_event_id text,
  ADD COLUMN IF NOT EXISTS reason_code text;

ALTER TABLE entitlement_ledger
  DROP CONSTRAINT IF EXISTS entitlement_ledger_batch_id_fkey;
ALTER TABLE entitlement_ledger
  ADD CONSTRAINT entitlement_ledger_batch_id_fkey
  FOREIGN KEY (batch_id) REFERENCES entitlement_batches(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entitlement_ledger_order_fk'
  ) THEN
    ALTER TABLE entitlement_ledger ADD CONSTRAINT entitlement_ledger_order_fk
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS entitlement_ledger_webhook_effect_once_idx
  ON entitlement_ledger (webhook_event_id, action)
  WHERE webhook_event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_entitlement_ledger_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ENTITLEMENT_LEDGER_IMMUTABLE'
    USING ERRCODE = 'integrity_constraint_violation';
END
$$;

DROP TRIGGER IF EXISTS entitlement_ledger_immutable_update ON entitlement_ledger;
CREATE TRIGGER entitlement_ledger_immutable_update
BEFORE UPDATE ON entitlement_ledger
FOR EACH ROW EXECUTE FUNCTION enforce_entitlement_ledger_immutability();

DROP TRIGGER IF EXISTS entitlement_ledger_immutable_delete ON entitlement_ledger;
CREATE TRIGGER entitlement_ledger_immutable_delete
BEFORE DELETE ON entitlement_ledger
FOR EACH ROW EXECUTE FUNCTION enforce_entitlement_ledger_immutability();
