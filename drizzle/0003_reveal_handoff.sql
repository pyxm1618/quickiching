ALTER TABLE login_intents
  ADD COLUMN IF NOT EXISTS expected_email_hash text,
  ADD COLUMN IF NOT EXISTS expected_email_key_version text;

CREATE UNIQUE INDEX IF NOT EXISTS login_intents_nonce_hash_once_idx
  ON login_intents (nonce_hash, nonce_key_version);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'login_intents_expected_email_pair_check'
  ) THEN
    ALTER TABLE login_intents
      ADD CONSTRAINT login_intents_expected_email_pair_check
      CHECK (
        (expected_email_hash IS NULL AND expected_email_key_version IS NULL)
        OR
        (expected_email_hash IS NOT NULL AND expected_email_key_version IS NOT NULL)
      );
  END IF;
END
$$;
