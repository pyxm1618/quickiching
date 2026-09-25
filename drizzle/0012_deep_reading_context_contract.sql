CREATE TABLE deep_reading_context_snapshots (
  casting_id uuid PRIMARY KEY REFERENCES casting_sessions(id) ON DELETE CASCADE,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  encryption_key_version text NOT NULL,
  snapshot_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_deep_reading_context_snapshot_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'DEEP_READING_CONTEXT_SNAPSHOT_IMMUTABLE';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER deep_reading_context_snapshot_immutable_trigger
BEFORE UPDATE ON deep_reading_context_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_deep_reading_context_snapshot_update();
--> statement-breakpoint
CREATE TABLE question_locks (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  key_version text NOT NULL,
  winning_casting_id uuid NOT NULL REFERENCES casting_sessions(id) ON DELETE CASCADE,
  locked_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, fingerprint)
);
--> statement-breakpoint
CREATE INDEX question_locks_winning_casting_idx ON question_locks (winning_casting_id);
--> statement-breakpoint
CREATE INDEX question_locks_locked_until_idx ON question_locks (locked_until);
--> statement-breakpoint
ALTER TABLE generation_output_reviews
  ADD COLUMN question_relevance_pass text,
  ADD COLUMN context_fidelity_pass text,
  ADD COLUMN evidence_grounding_pass text,
  ADD COLUMN interpretive_coherence_pass text,
  ADD COLUMN actionability_pass text,
  ADD COLUMN uncertainty_pass text,
  ADD COLUMN language_consistency_pass text;
--> statement-breakpoint
ALTER TABLE generation_output_reviews
  ADD CONSTRAINT generation_reviews_deep_reading_pass_fields_check
  CHECK (
    status <> 'pass'
    OR reviewer_model_version = 'reviewer-v1'
    OR (
      question_relevance_pass = 'true'
      AND context_fidelity_pass = 'true'
      AND evidence_grounding_pass = 'true'
      AND interpretive_coherence_pass = 'true'
      AND actionability_pass = 'true'
      AND uncertainty_pass = 'true'
      AND language_consistency_pass = 'true'
    )
  ) NOT VALID;
