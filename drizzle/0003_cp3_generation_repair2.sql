CREATE OR REPLACE FUNCTION ensure_generation_review_matches_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "generation_jobs"
    WHERE id = NEW.job_id AND casting_id = NEW.casting_id AND kind = NEW.kind
  ) THEN
    RAISE EXCEPTION 'GENERATION_REVIEW_KIND_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "generation_review_job_kind_trigger" ON "generation_output_reviews";
--> statement-breakpoint
CREATE TRIGGER "generation_review_job_kind_trigger"
BEFORE INSERT OR UPDATE OF job_id, casting_id, kind ON "generation_output_reviews"
FOR EACH ROW EXECUTE FUNCTION ensure_generation_review_matches_job();
