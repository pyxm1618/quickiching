ALTER TABLE cast_results
  ADD COLUMN IF NOT EXISTS result_hmac_key_version text;

CREATE INDEX IF NOT EXISTS cast_results_hmac_key_version_idx
  ON cast_results (result_hmac_key_version);
