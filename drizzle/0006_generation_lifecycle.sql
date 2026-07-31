CREATE OR REPLACE FUNCTION enforce_generation_completion_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed'
    AND OLD.status IS DISTINCT FROM 'completed'
    AND clock_timestamp() > OLD.timeout_at
  THEN
    RAISE EXCEPTION 'GENERATION_LATE_RESULT'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS generation_jobs_completion_deadline ON generation_jobs;
CREATE TRIGGER generation_jobs_completion_deadline
BEFORE UPDATE OF status ON generation_jobs
FOR EACH ROW
EXECUTE FUNCTION enforce_generation_completion_deadline();
