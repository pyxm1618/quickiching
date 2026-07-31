ALTER TABLE cast_results
  ADD COLUMN IF NOT EXISTS result_hmac_key_version text;

CREATE INDEX IF NOT EXISTS cast_results_hmac_key_version_idx
  ON cast_results (result_hmac_key_version);

CREATE OR REPLACE FUNCTION enforce_cast_result_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.result_hmac_key_version IS NULL
    AND NEW.result_hmac_key_version IS NOT NULL
    AND NEW.casting_session_id IS NOT DISTINCT FROM OLD.casting_session_id
    AND NEW.line_values IS NOT DISTINCT FROM OLD.line_values
    AND NEW.primary_hexagram_number IS NOT DISTINCT FROM OLD.primary_hexagram_number
    AND NEW.moving_line_positions IS NOT DISTINCT FROM OLD.moving_line_positions
    AND NEW.relating_hexagram_number IS NOT DISTINCT FROM OLD.relating_hexagram_number
    AND NEW.method_calculation IS NOT DISTINCT FROM OLD.method_calculation
    AND NEW.algorithm_version IS NOT DISTINCT FROM OLD.algorithm_version
    AND NEW.classic_mapping_version IS NOT DISTINCT FROM OLD.classic_mapping_version
    AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'CAST_RESULT_IMMUTABLE' USING ERRCODE = 'integrity_constraint_violation';
END
$$;

DROP TRIGGER IF EXISTS cast_results_immutable_trigger ON cast_results;
CREATE TRIGGER cast_results_immutable_trigger
BEFORE UPDATE ON cast_results
FOR EACH ROW
EXECUTE FUNCTION enforce_cast_result_immutability();
