DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "generation_output_reviews" review
    JOIN "generation_jobs" job ON job.id = review.job_id
    WHERE review.casting_id <> job.casting_id OR review.kind <> job.kind
  ) THEN
    RAISE EXCEPTION 'GENERATION_REVIEW_KIND_MISMATCH';
  END IF;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_generation_job_identity_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.casting_id IS DISTINCT FROM OLD.casting_id
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.generation_epoch IS DISTINCT FROM OLD.generation_epoch
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.input_snapshot_hash IS DISTINCT FROM OLD.input_snapshot_hash
  THEN
    RAISE EXCEPTION 'IMMUTABLE_GENERATION_JOB_IDENTITY';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "generation_job_identity_immutable_trigger" ON "generation_jobs";
--> statement-breakpoint
CREATE TRIGGER "generation_job_identity_immutable_trigger"
BEFORE UPDATE OF casting_id, kind, generation_epoch, idempotency_key, input_snapshot_hash ON "generation_jobs"
FOR EACH ROW EXECUTE FUNCTION prevent_generation_job_identity_update();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_jobs_casting_history_idx"
ON "generation_jobs" ("casting_id", "kind", "updated_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_jobs_retry_budget_idx"
ON "generation_jobs" ("casting_id", "kind", "updated_at")
WHERE "status" IN ('failed', 'timed_out', 'dead_letter');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_output_reviews_casting_idx"
ON "generation_output_reviews" ("casting_id");
