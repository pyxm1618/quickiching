CREATE TYPE "public"."audit_category" AS ENUM('checkout', 'webhook', 'entitlement', 'generation', 'reconcile', 'deletion', 'capability');--> statement-breakpoint
CREATE TYPE "public"."entitlement_reservation_status" AS ENUM('reserved', 'consumed', 'released', 'expired');--> statement-breakpoint
CREATE TYPE "public"."workflow_run_status" AS ENUM('start_pending', 'pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "audit_category" NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"user_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deep_reading_results" (
	"casting_id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"output" jsonb NOT NULL,
	"schema_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"integrity_hash" text NOT NULL,
	"persisted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deep_reading_results_job_id_unique" UNIQUE("job_id"),
	CONSTRAINT "deep_reading_results_reservation_id_unique" UNIQUE("reservation_id")
);
--> statement-breakpoint
CREATE TABLE "entitlement_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"casting_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"status" "entitlement_reservation_status" DEFAULT 'reserved' NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entitlement_reservations_lease_check" CHECK (
		("status" = 'reserved' AND "lease_token" IS NOT NULL) OR
		("status" <> 'reserved')
	)
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_name" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"provider_run_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"status" "workflow_run_status" DEFAULT 'pending' NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_runs_attempt_count_check" CHECK ("workflow_runs"."attempt_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deep_reading_results" ADD CONSTRAINT "deep_reading_results_casting_id_casting_sessions_id_fk" FOREIGN KEY ("casting_id") REFERENCES "public"."casting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deep_reading_results" ADD CONSTRAINT "deep_reading_results_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deep_reading_results" ADD CONSTRAINT "deep_reading_results_reservation_id_entitlement_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."entitlement_reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_reservations" ADD CONSTRAINT "entitlement_reservations_batch_id_entitlement_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."entitlement_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_reservations" ADD CONSTRAINT "entitlement_reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_reservations" ADD CONSTRAINT "entitlement_reservations_casting_id_casting_sessions_id_fk" FOREIGN KEY ("casting_id") REFERENCES "public"."casting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_reservations" ADD CONSTRAINT "entitlement_reservations_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_category_created_idx" ON "audit_events" USING btree ("category","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_user_created_idx" ON "audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "deep_reading_results_job_idx" ON "deep_reading_results" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "deep_reading_results_reservation_idx" ON "deep_reading_results" USING btree ("reservation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_reservations_active_casting_idx" ON "entitlement_reservations" USING btree ("casting_id") WHERE "entitlement_reservations"."status" = 'reserved';--> statement-breakpoint
CREATE INDEX "entitlement_reservations_user_status_idx" ON "entitlement_reservations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "entitlement_reservations_lease_idx" ON "entitlement_reservations" USING btree ("status","lease_expires_at");--> statement-breakpoint
CREATE INDEX "entitlement_reservations_expiry_idx" ON "entitlement_reservations" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_runs_idempotency_idx" ON "workflow_runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "workflow_runs_entity_idx" ON "workflow_runs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs" USING btree ("status","updated_at");--> statement-breakpoint

CREATE OR REPLACE FUNCTION validate_entitlement_reservation_ownership()
RETURNS trigger AS $$
DECLARE
  v_batch_user_id text;
  v_casting_user_id text;
  v_job_casting_id uuid;
  v_job_kind "public"."generation_kind";
BEGIN
  IF NEW.job_id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_JOB_REQUIRED';
  END IF;

  SELECT user_id INTO v_batch_user_id FROM entitlement_batches WHERE id = NEW.batch_id;
  IF v_batch_user_id IS NULL OR v_batch_user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'RESERVATION_BATCH_USER_MISMATCH';
  END IF;

  SELECT user_id INTO v_casting_user_id FROM casting_sessions WHERE id = NEW.casting_id;
  IF v_casting_user_id IS NULL OR v_casting_user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'RESERVATION_CASTING_USER_MISMATCH';
  END IF;

  SELECT casting_id, kind INTO v_job_casting_id, v_job_kind FROM generation_jobs WHERE id = NEW.job_id;
  IF v_job_casting_id IS NULL OR v_job_casting_id <> NEW.casting_id THEN
    RAISE EXCEPTION 'RESERVATION_JOB_CASTING_MISMATCH';
  END IF;
  IF v_job_kind <> 'deep_reading' THEN
    RAISE EXCEPTION 'RESERVATION_JOB_KIND_INVALID';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER entitlement_reservation_ownership_trigger
BEFORE INSERT OR UPDATE ON entitlement_reservations
FOR EACH ROW EXECUTE FUNCTION validate_entitlement_reservation_ownership();--> statement-breakpoint

CREATE OR REPLACE FUNCTION validate_deep_reading_results_insertion()
RETURNS trigger AS $$
DECLARE
  v_job_status "public"."generation_job_status";
  v_job_casting_id uuid;
  v_res_status "public"."entitlement_reservation_status";
  v_res_casting_id uuid;
  v_res_job_id uuid;
  v_review_status "public"."output_review_status";
BEGIN
  SELECT status, casting_id INTO v_job_status, v_job_casting_id
  FROM generation_jobs WHERE id = NEW.job_id;

  IF v_job_status IS NULL OR v_job_status <> 'running' OR v_job_casting_id <> NEW.casting_id THEN
    RAISE EXCEPTION 'RESULT_JOB_STATE_INVALID';
  END IF;

  SELECT status, casting_id, job_id INTO v_res_status, v_res_casting_id, v_res_job_id
  FROM entitlement_reservations WHERE id = NEW.reservation_id;

  IF v_res_status IS NULL OR v_res_status <> 'reserved' OR v_res_casting_id <> NEW.casting_id OR v_res_job_id <> NEW.job_id THEN
    RAISE EXCEPTION 'RESULT_RESERVATION_STATE_INVALID';
  END IF;

  SELECT status INTO v_review_status
  FROM generation_output_reviews WHERE job_id = NEW.job_id;

  IF v_review_status IS NULL OR v_review_status <> 'pass' THEN
    RAISE EXCEPTION 'RESULT_REVIEW_REQUIRED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER deep_reading_results_insertion_trigger
BEFORE INSERT ON deep_reading_results
FOR EACH ROW EXECUTE FUNCTION validate_deep_reading_results_insertion();--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_audit_events_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id = OLD.id
      AND NEW.category = OLD.category
      AND NEW.action = OLD.action
      AND NEW.entity_type = OLD.entity_type
      AND (NEW.entity_id IS NOT DISTINCT FROM OLD.entity_id)
      AND NEW.payload = OLD.payload
      AND NEW.created_at = OLD.created_at
      AND NEW.user_id IS NULL
      AND OLD.user_id IS NOT NULL
    THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'IMMUTABLE_AUDIT_EVENTS';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER audit_events_immutable_trigger
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_events_mutation();--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_deep_reading_results_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'IMMUTABLE_DEEP_READING_RESULTS';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'IMMUTABLE_DEEP_READING_RESULTS';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER deep_reading_results_immutable_trigger
BEFORE UPDATE OR DELETE ON deep_reading_results
FOR EACH ROW EXECUTE FUNCTION prevent_deep_reading_results_mutation();