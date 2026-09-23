DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payment_webhook_inbox
    GROUP BY provider, provider_environment, event_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'PAYMENT_WEBHOOK_EVENT_ID_CONFLICT';
  END IF;
END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS payment_inbox_delivery_idx;
--> statement-breakpoint
CREATE INDEX payment_inbox_delivery_idx
  ON payment_webhook_inbox (provider, provider_environment, delivery_id);
--> statement-breakpoint
DROP INDEX IF EXISTS payment_inbox_business_event_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX payment_inbox_business_event_idx
  ON payment_webhook_inbox (provider, provider_environment, event_id);
--> statement-breakpoint
CREATE TABLE refund_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL UNIQUE REFERENCES payment_orders(id) ON DELETE RESTRICT,
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_environment payment_environment NOT NULL,
  requested_minor integer NOT NULL,
  currency text NOT NULL,
  reason text NOT NULL,
  auto_screen text NOT NULL,
  screen_reason text,
  status text NOT NULL,
  provider_write_state text NOT NULL DEFAULT 'not_started',
  provider_write_attempt_count integer NOT NULL DEFAULT 0,
  refund_ticket_merchant_external_id text NOT NULL,
  provider_ticket_id text,
  provider_refund_id text,
  operator_note text,
  approved_at timestamp with time zone,
  rejected_at timestamp with time zone,
  provider_dispatched_at timestamp with time zone,
  next_reconcile_at timestamp with time zone,
  reconcile_lease_token text,
  reconcile_lease_expires_at timestamp with time zone,
  reconcile_attempt_count integer NOT NULL DEFAULT 0,
  last_error_code text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT refund_intents_amount_check CHECK (requested_minor > 0),
  CONSTRAINT refund_intents_currency_check CHECK (currency = 'USD'),
  CONSTRAINT refund_intents_auto_screen_check CHECK (auto_screen IN ('clear', 'manual_exception', 'rejected')),
  CONSTRAINT refund_intents_status_check CHECK (status IN (
    'manual_review', 'approved', 'rejected', 'processing',
    'reconciliation_required', 'succeeded', 'failed'
  )),
  CONSTRAINT refund_intents_provider_write_state_check CHECK (
    provider_write_state IN ('not_started', 'dispatched', 'confirmed', 'ambiguous')
  ),
  CONSTRAINT refund_intents_provider_write_attempt_check CHECK (
    provider_write_attempt_count >= 0 AND provider_write_attempt_count <= 1
  ),
  CONSTRAINT refund_intents_reconcile_attempt_check CHECK (reconcile_attempt_count >= 0),
  CONSTRAINT refund_intents_stable_correlation_check CHECK (
    refund_ticket_merchant_external_id = id::text
  ),
  CONSTRAINT refund_intents_approval_gate_check CHECK (
    provider_write_state = 'not_started' OR approved_at IS NOT NULL
  ),
  CONSTRAINT refund_intents_rejected_shape_check CHECK (
    status <> 'rejected' OR rejected_at IS NOT NULL
  ),
  CONSTRAINT refund_intents_succeeded_shape_check CHECK (
    status <> 'succeeded' OR provider_write_state = 'confirmed'
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX refund_intents_provider_ticket_idx
  ON refund_intents (provider_environment, provider_ticket_id)
  WHERE provider_ticket_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX refund_intents_provider_refund_idx
  ON refund_intents (provider_environment, provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX refund_intents_command_idx
  ON refund_intents (status, provider_write_state, created_at);
--> statement-breakpoint
CREATE INDEX refund_intents_reconcile_idx
  ON refund_intents (status, next_reconcile_at, reconcile_lease_expires_at);
