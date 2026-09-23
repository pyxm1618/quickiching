ALTER TABLE "deep_reading_results" ADD COLUMN IF NOT EXISTS "integrity_key_version" text;--> statement-breakpoint
UPDATE "deep_reading_results"
SET "integrity_key_version" = 'legacy-unversioned'
WHERE "integrity_key_version" IS NULL;--> statement-breakpoint
ALTER TABLE "deep_reading_results" ALTER COLUMN "integrity_key_version" SET NOT NULL;--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_deep_reading_results_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND current_setting('quickiching.privacy_erasure', true) = 'on'
  THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'IMMUTABLE_DEEP_READING_RESULTS';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
