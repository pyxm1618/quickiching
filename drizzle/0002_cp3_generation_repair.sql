ALTER TABLE "generation_output_reviews" ADD CONSTRAINT "generation_reviews_pass_fields_check" CHECK ("generation_output_reviews"."status" <> 'pass' or ("generation_output_reviews"."schema_valid" = 'true' and "generation_output_reviews"."safety_pass" = 'true' and "generation_output_reviews"."fact_consistency_pass" = 'true'));
--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_id_casting_unique" UNIQUE ("id", "casting_id");
--> statement-breakpoint
ALTER TABLE "generation_output_reviews" ADD CONSTRAINT "generation_output_reviews_job_casting_fk" FOREIGN KEY ("job_id", "casting_id") REFERENCES "generation_jobs"("id", "casting_id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "preview_results" ADD CONSTRAINT "preview_results_job_casting_fk" FOREIGN KEY ("job_id", "casting_id") REFERENCES "generation_jobs"("id", "casting_id") ON DELETE RESTRICT ON UPDATE no action;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "cast_results_immutable_trigger" ON "cast_results";
--> statement-breakpoint
CREATE TRIGGER "cast_results_immutable_trigger"
BEFORE UPDATE ON "cast_results"
FOR EACH ROW EXECUTE FUNCTION prevent_generation_immutable_row();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "question_versions_immutable_trigger" ON "question_versions";
--> statement-breakpoint
CREATE TRIGGER "question_versions_immutable_trigger"
BEFORE UPDATE ON "question_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_generation_immutable_row();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "preview_results_immutable_trigger" ON "preview_results";
--> statement-breakpoint
CREATE TRIGGER "preview_results_immutable_trigger"
BEFORE UPDATE ON "preview_results"
FOR EACH ROW EXECUTE FUNCTION prevent_generation_immutable_row();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ensure_preview_insert_is_completed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "generation_jobs"
    WHERE id = NEW.job_id AND casting_id = NEW.casting_id
      AND kind = 'preview' AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'PREVIEW_REQUIRES_COMPLETED_JOB';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "generation_output_reviews"
    WHERE job_id = NEW.job_id AND casting_id = NEW.casting_id
      AND status = 'pass'
      AND schema_valid = 'true' AND safety_pass = 'true' AND fact_consistency_pass = 'true'
  ) THEN
    RAISE EXCEPTION 'PREVIEW_REQUIRES_PASSING_REVIEW';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "preview_result_completed_review_trigger" ON "preview_results";
--> statement-breakpoint
CREATE TRIGGER "preview_result_completed_review_trigger"
BEFORE INSERT ON "preview_results"
FOR EACH ROW EXECUTE FUNCTION ensure_preview_insert_is_completed();
