CREATE OR REPLACE FUNCTION fence_generation_lock_namespace_on_casting_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lifecycle = 'user_deleted'
    AND OLD.lifecycle IS DISTINCT FROM 'user_deleted'
  THEN
    IF NOT pg_try_advisory_xact_lock(
      hashtextextended(NEW.id || ':preview', 0)
    ) THEN
      RAISE EXCEPTION 'CASTING_DELETE_RETRY'
        USING ERRCODE = '40001';
    END IF;
    IF NOT pg_try_advisory_xact_lock(
      hashtextextended(NEW.id || ':deep_reading', 0)
    ) THEN
      RAISE EXCEPTION 'CASTING_DELETE_RETRY'
        USING ERRCODE = '40001';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS casting_delete_generation_advisory_fence ON casting_sessions;
CREATE TRIGGER casting_delete_generation_advisory_fence
BEFORE UPDATE OF lifecycle ON casting_sessions
FOR EACH ROW
EXECUTE FUNCTION fence_generation_lock_namespace_on_casting_delete();
