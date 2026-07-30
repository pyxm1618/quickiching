ALTER TABLE cast_results
  ADD COLUMN result_hmac_key_version text;
UPDATE cast_results SET result_hmac_key_version = 'legacy' WHERE result_hmac_key_version IS NULL;
ALTER TABLE cast_results ALTER COLUMN result_hmac_key_version SET NOT NULL;

CREATE INDEX casting_sessions_expiry_cleanup_idx
  ON casting_sessions(lifecycle, casting_expires_at, reveal_expires_at, purge_after);
CREATE INDEX generation_jobs_timeout_cleanup_idx
  ON generation_jobs(status, timeout_at);
