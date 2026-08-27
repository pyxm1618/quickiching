ALTER TYPE "public"."payment_inbox_status" ADD VALUE 'processing' BEFORE 'processed';--> statement-breakpoint
CREATE TABLE "payment_checkout_budgets" (
	"user_id" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_checkout_budgets_attempt_count_check" CHECK ("payment_checkout_budgets"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'waffo' NOT NULL,
	"provider_environment" "payment_environment" NOT NULL,
	"conflict_type" text NOT NULL,
	"reason_code" text NOT NULL,
	"existing_inbox_id" uuid,
	"incoming_inbox_id" uuid,
	"existing_order_id" uuid,
	"incoming_order_id" uuid,
	"existing_payload_sha256" text,
	"incoming_payload_sha256" text,
	"existing_canonical_payload_sha256" text,
	"incoming_canonical_payload_sha256" text,
	"safe_existing_payload" jsonb,
	"safe_incoming_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_webhook_conflicts_provider_check" CHECK ("payment_webhook_conflicts"."provider" = 'waffo')
);
--> statement-breakpoint
ALTER TABLE "payment_orders" DROP CONSTRAINT "payment_orders_checkout_shape_check";--> statement-breakpoint
DROP INDEX "payment_outbox_inbox_topic_idx";--> statement-breakpoint
ALTER TABLE "payment_webhook_inbox" ADD COLUMN "canonical_payload_sha256" text;--> statement-breakpoint
ALTER TABLE "payment_webhook_inbox" ADD COLUMN "replay_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_webhook_inbox" ADD COLUMN "last_replay_reason" text;--> statement-breakpoint
ALTER TABLE "payment_checkout_budgets" ADD CONSTRAINT "payment_checkout_budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_conflicts" ADD CONSTRAINT "payment_webhook_conflicts_existing_inbox_id_payment_webhook_inbox_id_fk" FOREIGN KEY ("existing_inbox_id") REFERENCES "public"."payment_webhook_inbox"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_conflicts" ADD CONSTRAINT "payment_webhook_conflicts_incoming_inbox_id_payment_webhook_inbox_id_fk" FOREIGN KEY ("incoming_inbox_id") REFERENCES "public"."payment_webhook_inbox"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_conflicts" ADD CONSTRAINT "payment_webhook_conflicts_existing_order_id_payment_orders_id_fk" FOREIGN KEY ("existing_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_conflicts" ADD CONSTRAINT "payment_webhook_conflicts_incoming_order_id_payment_orders_id_fk" FOREIGN KEY ("incoming_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_webhook_conflicts_order_idx" ON "payment_webhook_conflicts" USING btree ("existing_order_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_webhook_conflicts_inbox_idx" ON "payment_webhook_conflicts" USING btree ("existing_inbox_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_ledger_order_action_once_idx" ON "entitlement_ledger" USING btree ("order_id","action") WHERE "entitlement_ledger"."action" in ('grant', 'revoke');--> statement-breakpoint
CREATE UNIQUE INDEX "payment_outbox_inbox_idx" ON "payment_outbox" USING btree ("inbox_id");--> statement-breakpoint
CREATE INDEX "payment_inbox_pending_refund_idx" ON "payment_webhook_inbox" USING btree ("linked_order_id","status","event_type","created_at") WHERE "payment_webhook_inbox"."event_type" = 'refund.succeeded';--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_checkout_shape_check" CHECK ((
      "payment_orders"."status" = 'pending'
      or ("payment_orders"."status" = 'checkout_initializing' and "payment_orders"."checkout_claim_token" is not null and "payment_orders"."checkout_claim_expires_at" is not null)
      or ("payment_orders"."status" = 'checkout_created' and "payment_orders"."provider_checkout_session_id" is not null and "payment_orders"."provider_checkout_url" is not null and "payment_orders"."checkout_expires_at" is not null)
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

CREATE OR REPLACE FUNCTION prevent_payment_order_identity_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.product_key IS DISTINCT FROM OLD.product_key
    OR NEW.quantity IS DISTINCT FROM OLD.quantity
    OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.request_id IS DISTINCT FROM OLD.request_id
    OR NEW.provider IS DISTINCT FROM OLD.provider
    OR NEW.provider_environment IS DISTINCT FROM OLD.provider_environment
    OR NEW.provider_product_id IS DISTINCT FROM OLD.provider_product_id
    OR (OLD.provider_order_id IS NOT NULL AND NEW.provider_order_id IS DISTINCT FROM OLD.provider_order_id)
    OR (OLD.provider_payment_id IS NOT NULL AND NEW.provider_payment_id IS DISTINCT FROM OLD.provider_payment_id)
  THEN
    RAISE EXCEPTION 'IMMUTABLE_PAYMENT_ORDER_IDENTITY';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_entitlement_batch_order_consistency()
RETURNS trigger AS $$
DECLARE
  payment_user_id text;
  payment_quantity integer;
BEGIN
  SELECT user_id, quantity INTO payment_user_id, payment_quantity
  FROM payment_orders WHERE id = NEW.order_id;
  IF payment_user_id IS NULL OR payment_user_id IS DISTINCT FROM NEW.user_id
    OR payment_quantity IS DISTINCT FROM NEW.quantity_total
  THEN
    RAISE EXCEPTION 'ENTITLEMENT_BATCH_PAYMENT_ORDER_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER entitlement_batch_order_consistency_trigger
BEFORE INSERT OR UPDATE OF user_id, order_id, quantity_total ON entitlement_batches
FOR EACH ROW EXECUTE FUNCTION enforce_entitlement_batch_order_consistency();--> statement-breakpoint

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
    IF inbox_order_id IS NOT NULL AND inbox_order_id IS DISTINCT FROM NEW.order_id THEN
      RAISE EXCEPTION 'ENTITLEMENT_LEDGER_INBOX_ORDER_MISMATCH';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER entitlement_ledger_association_trigger
BEFORE INSERT ON entitlement_ledger
FOR EACH ROW EXECUTE FUNCTION enforce_entitlement_ledger_associations();--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_payment_outbox_order_consistency()
RETURNS trigger AS $$
DECLARE
  inbox_order_id uuid;
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    SELECT linked_order_id INTO inbox_order_id
    FROM payment_webhook_inbox WHERE id = NEW.inbox_id;
    IF inbox_order_id IS NOT NULL AND inbox_order_id IS DISTINCT FROM NEW.order_id THEN
      RAISE EXCEPTION 'PAYMENT_OUTBOX_INBOX_ORDER_MISMATCH';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER payment_outbox_order_consistency_trigger
BEFORE INSERT OR UPDATE OF inbox_id, order_id ON payment_outbox
FOR EACH ROW EXECUTE FUNCTION enforce_payment_outbox_order_consistency();--> statement-breakpoint
