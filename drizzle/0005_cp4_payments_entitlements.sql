CREATE TYPE "public"."entitlement_ledger_action" AS ENUM('grant', 'reserve', 'consume', 'release', 'expire', 'revoke', 'compensate');--> statement-breakpoint
CREATE TYPE "public"."financial_review_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."payment_environment" AS ENUM('test', 'prod');--> statement-breakpoint
CREATE TYPE "public"."payment_inbox_status" AS ENUM('received', 'processed', 'ignored', 'pending_order', 'financial_review', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."payment_order_status" AS ENUM('pending', 'checkout_initializing', 'checkout_created', 'paid', 'refunded', 'financial_review');--> statement-breakpoint
CREATE TYPE "public"."payment_outbox_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."payment_outbox_topic" AS ENUM('grant_entitlement', 'revoke_entitlement', 'financial_review');--> statement-breakpoint
CREATE TYPE "public"."payment_product_key" AS ENUM('one', 'three', 'five');--> statement-breakpoint
CREATE TABLE "entitlement_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"quantity_total" integer NOT NULL,
	"quantity_available" integer NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"quantity_consumed" integer DEFAULT 0 NOT NULL,
	"quantity_revoked" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entitlement_batches_identity_check" CHECK (
      "entitlement_batches"."quantity_total" > 0
      and "entitlement_batches"."quantity_available" >= 0
      and "entitlement_batches"."quantity_reserved" >= 0
      and "entitlement_batches"."quantity_consumed" >= 0
      and "entitlement_batches"."quantity_revoked" >= 0
      and "entitlement_batches"."quantity_available" + "entitlement_batches"."quantity_reserved" + "entitlement_batches"."quantity_consumed" + "entitlement_batches"."quantity_revoked" = "entitlement_batches"."quantity_total"
    )
);
--> statement-breakpoint
CREATE TABLE "entitlement_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"webhook_inbox_id" uuid,
	"action" "entitlement_ledger_action" NOT NULL,
	"quantity" integer NOT NULL,
	"business_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entitlement_ledger_quantity_check" CHECK ("entitlement_ledger"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_financial_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"inbox_id" uuid NOT NULL,
	"reason_code" text NOT NULL,
	"status" "financial_review_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"product_key" "payment_product_key" NOT NULL,
	"quantity" integer NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"request_id" text NOT NULL,
	"provider" text DEFAULT 'waffo' NOT NULL,
	"provider_environment" "payment_environment" NOT NULL,
	"provider_product_id" text NOT NULL,
	"provider_checkout_session_id" text,
	"provider_checkout_url" text,
	"checkout_expires_at" timestamp with time zone,
	"checkout_claim_token" text,
	"checkout_claim_expires_at" timestamp with time zone,
	"checkout_error_code" text,
	"provider_order_id" text,
	"provider_payment_id" text,
	"status" "payment_order_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_orders_currency_check" CHECK ("payment_orders"."currency" = 'USD'),
	CONSTRAINT "payment_orders_provider_check" CHECK ("payment_orders"."provider" = 'waffo'),
	CONSTRAINT "payment_orders_product_truth_check" CHECK ((
      ("payment_orders"."product_key" = 'one' and "payment_orders"."quantity" = 1 and "payment_orders"."amount_minor" = 299)
      or ("payment_orders"."product_key" = 'three' and "payment_orders"."quantity" = 3 and "payment_orders"."amount_minor" = 699)
      or ("payment_orders"."product_key" = 'five' and "payment_orders"."quantity" = 5 and "payment_orders"."amount_minor" = 999)
    )),
	CONSTRAINT "payment_orders_checkout_shape_check" CHECK ((
      "payment_orders"."status" = 'pending'
      or ("payment_orders"."status" = 'checkout_initializing' and "payment_orders"."checkout_claim_token" is not null and "payment_orders"."checkout_claim_expires_at" is not null)
      or ("payment_orders"."status" = 'checkout_created' and "payment_orders"."provider_checkout_session_id" is not null and "payment_orders"."provider_checkout_url" is not null and "payment_orders"."checkout_expires_at" is not null)
      or "payment_orders"."status" in ('paid', 'refunded', 'financial_review')
    ))
);
--> statement-breakpoint
CREATE TABLE "payment_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inbox_id" uuid NOT NULL,
	"order_id" uuid,
	"topic" "payment_outbox_topic" NOT NULL,
	"status" "payment_outbox_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"last_error_code" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_outbox_attempt_count_check" CHECK ("payment_outbox"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'waffo' NOT NULL,
	"provider_environment" "payment_environment" NOT NULL,
	"delivery_id" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"store_id" text NOT NULL,
	"order_merchant_external_id" text,
	"linked_order_id" uuid,
	"payload_sha256" text NOT NULL,
	"normalized_payload" jsonb NOT NULL,
	"signature_verified_at" timestamp with time zone NOT NULL,
	"status" "payment_inbox_status" DEFAULT 'received' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_inbox_provider_check" CHECK ("payment_webhook_inbox"."provider" = 'waffo'),
	CONSTRAINT "payment_inbox_attempt_count_check" CHECK ("payment_webhook_inbox"."attempt_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "entitlement_batches" ADD CONSTRAINT "entitlement_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_batches" ADD CONSTRAINT "entitlement_batches_order_id_payment_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."payment_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_ledger" ADD CONSTRAINT "entitlement_ledger_batch_id_entitlement_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."entitlement_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_ledger" ADD CONSTRAINT "entitlement_ledger_order_id_payment_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."payment_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_ledger" ADD CONSTRAINT "entitlement_ledger_webhook_inbox_id_payment_webhook_inbox_id_fk" FOREIGN KEY ("webhook_inbox_id") REFERENCES "public"."payment_webhook_inbox"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_financial_reviews" ADD CONSTRAINT "payment_financial_reviews_order_id_payment_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."payment_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_financial_reviews" ADD CONSTRAINT "payment_financial_reviews_inbox_id_payment_webhook_inbox_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."payment_webhook_inbox"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_outbox" ADD CONSTRAINT "payment_outbox_inbox_id_payment_webhook_inbox_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."payment_webhook_inbox"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_outbox" ADD CONSTRAINT "payment_outbox_order_id_payment_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."payment_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_inbox" ADD CONSTRAINT "payment_webhook_inbox_linked_order_id_payment_orders_id_fk" FOREIGN KEY ("linked_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_batches_order_idx" ON "entitlement_batches" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "entitlement_batches_user_expiry_idx" ON "entitlement_batches" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_ledger_business_key_idx" ON "entitlement_ledger" USING btree ("business_key");--> statement-breakpoint
CREATE INDEX "entitlement_ledger_batch_history_idx" ON "entitlement_ledger" USING btree ("batch_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_financial_reviews_inbox_idx" ON "payment_financial_reviews" USING btree ("inbox_id");--> statement-breakpoint
CREATE INDEX "payment_financial_reviews_open_idx" ON "payment_financial_reviews" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_user_request_idx" ON "payment_orders" USING btree ("user_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_checkout_session_idx" ON "payment_orders" USING btree ("provider_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_provider_order_idx" ON "payment_orders" USING btree ("provider","provider_environment","provider_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_provider_payment_idx" ON "payment_orders" USING btree ("provider","provider_environment","provider_payment_id");--> statement-breakpoint
CREATE INDEX "payment_orders_user_history_idx" ON "payment_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_outbox_inbox_topic_idx" ON "payment_outbox" USING btree ("inbox_id","topic");--> statement-breakpoint
CREATE INDEX "payment_outbox_dispatch_idx" ON "payment_outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_inbox_delivery_idx" ON "payment_webhook_inbox" USING btree ("provider","provider_environment","delivery_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_inbox_business_event_idx" ON "payment_webhook_inbox" USING btree ("provider","provider_environment","event_type","event_id");--> statement-breakpoint
CREATE INDEX "payment_inbox_order_idx" ON "payment_webhook_inbox" USING btree ("order_merchant_external_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_inbox_retry_idx" ON "payment_webhook_inbox" USING btree ("status","updated_at");--> statement-breakpoint

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
  THEN
    RAISE EXCEPTION 'IMMUTABLE_PAYMENT_ORDER_IDENTITY';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER payment_order_identity_immutable_trigger
BEFORE UPDATE ON payment_orders
FOR EACH ROW EXECUTE FUNCTION prevent_payment_order_identity_update();--> statement-breakpoint

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
    OR NEW.normalized_payload IS DISTINCT FROM OLD.normalized_payload
    OR NEW.signature_verified_at IS DISTINCT FROM OLD.signature_verified_at
  THEN
    RAISE EXCEPTION 'IMMUTABLE_PAYMENT_INBOX_IDENTITY';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER payment_inbox_identity_immutable_trigger
BEFORE UPDATE ON payment_webhook_inbox
FOR EACH ROW EXECUTE FUNCTION prevent_payment_inbox_identity_update();--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_entitlement_batch_identity_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.order_id IS DISTINCT FROM OLD.order_id
    OR NEW.quantity_total IS DISTINCT FROM OLD.quantity_total
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
  THEN
    RAISE EXCEPTION 'IMMUTABLE_ENTITLEMENT_BATCH_IDENTITY';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER entitlement_batch_identity_immutable_trigger
BEFORE UPDATE ON entitlement_batches
FOR EACH ROW EXECUTE FUNCTION prevent_entitlement_batch_identity_update();--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_entitlement_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_ENTITLEMENT_LEDGER';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER entitlement_ledger_immutable_trigger
BEFORE UPDATE OR DELETE ON entitlement_ledger
FOR EACH ROW EXECUTE FUNCTION prevent_entitlement_ledger_mutation();
