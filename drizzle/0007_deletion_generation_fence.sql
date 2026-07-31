ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_reading_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_active_per_reading_idx
  ON reservations (reading_id)
  WHERE status = 'reserved';

CREATE INDEX IF NOT EXISTS reservations_reading_history_idx
  ON reservations (reading_id, created_at, id);

CREATE OR REPLACE FUNCTION fence_generation_on_casting_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_job record;
  v_reading record;
  v_reservation record;
  v_batch record;
  v_now timestamptz;
  v_expired boolean;
  v_ledger_id text;
BEGIN
  IF NEW.lifecycle = 'user_deleted'
    AND OLD.lifecycle IS DISTINCT FROM 'user_deleted'
  THEN
    -- Service callers acquire these locks before the casting row. A direct SQL
    -- caller must not wait while holding the row, because enqueue acquires the
    -- advisory lock before reading the casting. Fail with a retryable SQLSTATE
    -- instead of permitting a lock-order deadlock or an unfenced deletion.
    IF NOT pg_try_advisory_xact_lock(hashtext(NEW.id || ':preview')) THEN
      RAISE EXCEPTION 'CASTING_DELETE_RETRY'
        USING ERRCODE = '40001';
    END IF;
    IF NOT pg_try_advisory_xact_lock(hashtext(NEW.id || ':deep_reading')) THEN
      RAISE EXCEPTION 'CASTING_DELETE_RETRY'
        USING ERRCODE = '40001';
    END IF;

    v_now := clock_timestamp();
    FOR v_job IN
      SELECT * FROM generation_jobs
      WHERE casting_session_id = NEW.id
        AND status IN ('queued', 'running')
      FOR UPDATE
    LOOP
      UPDATE generation_attempts SET
        status = 'failed',
        error_code = 'CASTING_DELETED',
        error_class = 'terminal',
        finished_at = v_now
      WHERE job_id = v_job.id AND status = 'running';

      UPDATE outbox SET dispatched_at = COALESCE(dispatched_at, v_now)
      WHERE aggregate_id = v_job.id AND dispatched_at IS NULL;

      IF v_job.job_type = 'preview' THEN
        UPDATE previews SET
          status = 'failed', relevance_statement = NULL, updated_at = v_now
        WHERE casting_session_id = NEW.id
          AND status IN ('queued', 'generating');
      ELSIF v_job.reading_id IS NOT NULL THEN
        SELECT * INTO v_reading
        FROM readings WHERE id = v_job.reading_id FOR UPDATE;

        IF FOUND AND v_reading.reservation_id IS NOT NULL THEN
          SELECT * INTO v_reservation
          FROM reservations
          WHERE id = v_reading.reservation_id
          FOR UPDATE;

          IF FOUND AND v_reservation.status = 'reserved' THEN
            SELECT * INTO v_batch
            FROM entitlement_batches
            WHERE id = v_reservation.batch_id
            FOR UPDATE;

            IF FOUND THEN
              v_expired := v_batch.expires_at <= v_now;
              UPDATE entitlement_batches SET
                quantity_reserved = quantity_reserved - 1,
                quantity_available = quantity_available + CASE WHEN v_expired THEN 0 ELSE 1 END,
                quantity_revoked = quantity_revoked + CASE WHEN v_expired THEN 1 ELSE 0 END,
                updated_at = v_now
              WHERE id = v_batch.id;

              UPDATE reservations SET
                status = CASE WHEN v_expired THEN 'expired'::reservation_status ELSE 'released'::reservation_status END,
                updated_at = v_now
              WHERE id = v_reservation.id;

              v_ledger_id := 'led_' || substring(
                md5(v_job.id || ':' || v_reservation.id || ':' || v_now::text),
                1,
                24
              );
              INSERT INTO entitlement_ledger (
                id, batch_id, order_id, action, quantity, reading_id,
                reservation_id, reason_code, created_at
              ) VALUES (
                v_ledger_id,
                v_batch.id,
                v_batch.order_id,
                CASE WHEN v_expired THEN 'revoke'::ledger_action ELSE 'release'::ledger_action END,
                1,
                v_reading.id,
                v_reservation.id,
                'casting_deleted',
                v_now
              );
            END IF;
          END IF;
        END IF;

        IF FOUND THEN
          UPDATE readings SET
            status = 'failed',
            reservation_id = NULL,
            generation_epoch = GREATEST(generation_epoch, v_job.generation_epoch + 1),
            updated_at = v_now
          WHERE id = v_job.reading_id AND status <> 'completed';
        END IF;
      END IF;

      UPDATE generation_jobs SET
        status = 'cancelled',
        generation_epoch = generation_epoch + 1,
        error_code = 'CASTING_DELETED',
        last_error_code = 'CASTING_DELETED',
        completed_at = v_now,
        updated_at = v_now
      WHERE id = v_job.id;
    END LOOP;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS casting_delete_generation_fence ON casting_sessions;
CREATE TRIGGER casting_delete_generation_fence
BEFORE UPDATE OF lifecycle ON casting_sessions
FOR EACH ROW
EXECUTE FUNCTION fence_generation_on_casting_delete();
