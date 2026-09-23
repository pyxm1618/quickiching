CREATE TYPE "public"."commercial_casting_lifecycle" AS ENUM('draft', 'casting', 'awaiting_reveal', 'revealed', 'expired', 'discarded_duplicate', 'emergency_blocked', 'user_deleted');--> statement-breakpoint
CREATE TYPE "public"."generation_job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'timed_out', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."generation_kind" AS ENUM('preview', 'deep_reading');--> statement-breakpoint
CREATE TYPE "public"."output_review_status" AS ENUM('pass', 'fail');--> statement-breakpoint
CREATE TABLE "cast_results" (
	"casting_id" uuid PRIMARY KEY NOT NULL,
	"line_values" integer[] NOT NULL,
	"primary_hexagram_number" integer NOT NULL,
	"moving_line_positions" integer[] NOT NULL,
	"relating_hexagram_number" integer,
	"method_calculation" jsonb NOT NULL,
	"algorithm_version" text NOT NULL,
	"classic_mapping_version" text NOT NULL,
	"result_hmac" text NOT NULL,
	"result_hmac_key_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cast_results_six_lines_check" CHECK (cardinality("cast_results"."line_values") = 6),
	CONSTRAINT "cast_results_line_values_check" CHECK ("cast_results"."line_values" <@ ARRAY[6, 7, 8, 9]::integer[]),
	CONSTRAINT "cast_results_primary_hexagram_check" CHECK ("cast_results"."primary_hexagram_number" between 1 and 64),
	CONSTRAINT "cast_results_relating_hexagram_check" CHECK ("cast_results"."relating_hexagram_number" is null or "cast_results"."relating_hexagram_number" between 1 and 64)
);
--> statement-breakpoint
CREATE TABLE "casting_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"method" text NOT NULL,
	"lifecycle" "commercial_casting_lifecycle" DEFAULT 'draft' NOT NULL,
	"risk_status" text DEFAULT 'not_checked' NOT NULL,
	"risk_rule_version" text,
	"scene" text NOT NULL,
	"interpretation_goal" text NOT NULL,
	"question_fingerprint" text,
	"fingerprint_key_version" text,
	"generation_epoch" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "casting_sessions_risk_status_check" CHECK ("casting_sessions"."risk_status" in ('not_checked', 'allowed', 'professional_decision_blocked', 'needs_clarification', 'emergency_blocked')),
	CONSTRAINT "casting_sessions_generation_epoch_check" CHECK ("casting_sessions"."generation_epoch" >= 0)
);
--> statement-breakpoint
CREATE TABLE "generation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"retry_classification" text NOT NULL,
	"timeout_code" text,
	"error_code" text,
	CONSTRAINT "generation_attempts_number_positive_check" CHECK ("generation_attempts"."attempt_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"casting_id" uuid NOT NULL,
	"kind" "generation_kind" NOT NULL,
	"status" "generation_job_status" DEFAULT 'queued' NOT NULL,
	"generation_epoch" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"input_snapshot_hash" text NOT NULL,
	"timeout_at" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"lease_owner" text,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"model_identifier" text,
	"provider_request_identifier" text,
	"token_usage" jsonb,
	"cost_metadata" jsonb,
	"structured_error_code" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_jobs_epoch_check" CHECK ("generation_jobs"."generation_epoch" >= 0),
	CONSTRAINT "generation_jobs_attempt_count_check" CHECK ("generation_jobs"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "generation_output_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"casting_id" uuid NOT NULL,
	"kind" "generation_kind" NOT NULL,
	"status" "output_review_status" NOT NULL,
	"reason_codes" jsonb NOT NULL,
	"reviewer_model_version" text NOT NULL,
	"schema_valid" text NOT NULL,
	"safety_pass" text NOT NULL,
	"fact_consistency_pass" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_output_reviews_job_id_unique" UNIQUE("job_id"),
	CONSTRAINT "generation_reviews_boolean_fields_check" CHECK ("generation_output_reviews"."schema_valid" in ('true', 'false') and "generation_output_reviews"."safety_pass" in ('true', 'false') and "generation_output_reviews"."fact_consistency_pass" in ('true', 'false'))
);
--> statement-breakpoint
CREATE TABLE "preview_results" (
	"casting_id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"output" jsonb NOT NULL,
	"schema_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"integrity_hash" text NOT NULL,
	"persisted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preview_results_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "question_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"casting_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"encryption_key_version" text NOT NULL,
	"fingerprint_key_version" text NOT NULL,
	"fingerprint" text NOT NULL,
	"created_reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_versions_version_positive_check" CHECK ("question_versions"."version_number" > 0)
);
--> statement-breakpoint
ALTER TABLE "cast_results" ADD CONSTRAINT "cast_results_casting_id_casting_sessions_id_fk" FOREIGN KEY ("casting_id") REFERENCES "public"."casting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casting_sessions" ADD CONSTRAINT "casting_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_attempts" ADD CONSTRAINT "generation_attempts_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_casting_id_casting_sessions_id_fk" FOREIGN KEY ("casting_id") REFERENCES "public"."casting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_output_reviews" ADD CONSTRAINT "generation_output_reviews_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_output_reviews" ADD CONSTRAINT "generation_output_reviews_casting_id_casting_sessions_id_fk" FOREIGN KEY ("casting_id") REFERENCES "public"."casting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_results" ADD CONSTRAINT "preview_results_casting_id_casting_sessions_id_fk" FOREIGN KEY ("casting_id") REFERENCES "public"."casting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_results" ADD CONSTRAINT "preview_results_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_casting_id_casting_sessions_id_fk" FOREIGN KEY ("casting_id") REFERENCES "public"."casting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "casting_sessions_user_idx" ON "casting_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_attempts_job_attempt_idx" ON "generation_attempts" USING btree ("job_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_jobs_idempotency_idx" ON "generation_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_jobs_active_kind_idx" ON "generation_jobs" USING btree ("casting_id","kind") WHERE "generation_jobs"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "generation_jobs_lease_idx" ON "generation_jobs" USING btree ("status","lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "question_versions_casting_version_idx" ON "question_versions" USING btree ("casting_id","version_number");--> statement-breakpoint
CREATE INDEX "question_versions_fingerprint_idx" ON "question_versions" USING btree ("fingerprint");--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_generation_immutable_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_GENERATION_ROW';
END;
$$;--> statement-breakpoint
CREATE TRIGGER cast_results_immutable_trigger
BEFORE UPDATE OR DELETE ON "cast_results"
FOR EACH ROW EXECUTE FUNCTION prevent_generation_immutable_row();--> statement-breakpoint
CREATE TRIGGER question_versions_immutable_trigger
BEFORE UPDATE OR DELETE ON "question_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_generation_immutable_row();--> statement-breakpoint
CREATE TRIGGER preview_results_immutable_trigger
BEFORE UPDATE OR DELETE ON "preview_results"
FOR EACH ROW EXECUTE FUNCTION prevent_generation_immutable_row();--> statement-breakpoint
CREATE OR REPLACE FUNCTION ensure_preview_result_is_reviewed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind = 'preview' AND NEW.status = 'completed' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "preview_results" result
      JOIN "generation_output_reviews" review ON review.job_id = result.job_id
      WHERE result.job_id = NEW.id AND review.status = 'pass'
    ) THEN
      RAISE EXCEPTION 'COMPLETED_PREVIEW_REQUIRES_REVIEWED_RESULT';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER generation_job_completed_result_trigger
AFTER INSERT OR UPDATE OF status ON "generation_jobs"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION ensure_preview_result_is_reviewed();--> statement-breakpoint
CREATE OR REPLACE FUNCTION ensure_preview_insert_is_completed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "generation_jobs"
    WHERE id = NEW.job_id AND kind = 'preview' AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'PREVIEW_REQUIRES_COMPLETED_JOB';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "generation_output_reviews"
    WHERE job_id = NEW.job_id AND status = 'pass'
  ) THEN
    RAISE EXCEPTION 'PREVIEW_REQUIRES_PASSING_REVIEW';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER preview_result_completed_review_trigger
BEFORE INSERT ON "preview_results"
FOR EACH ROW EXECUTE FUNCTION ensure_preview_insert_is_completed();
