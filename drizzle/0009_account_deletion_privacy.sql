ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_purge_after timestamptz,
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_account_deletion_dates_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_account_deletion_dates_check CHECK (
      (deleted_at IS NULL AND content_purge_after IS NULL AND anonymized_at IS NULL)
      OR (deleted_at IS NOT NULL AND content_purge_after IS NOT NULL AND anonymized_at IS NOT NULL)
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('pending_content_purge', 'purged')),
  email_hmac text NOT NULL,
  email_hmac_key_version text NOT NULL,
  requested_at timestamptz NOT NULL,
  content_purge_after timestamptz NOT NULL,
  purged_at timestamptz,
  unused_credits_revoked integer NOT NULL DEFAULT 0 CHECK (unused_credits_revoked >= 0),
  open_reviews_closed integer NOT NULL DEFAULT 0 CHECK (open_reviews_closed >= 0),
  retained_order_count integer NOT NULL DEFAULT 0 CHECK (retained_order_count >= 0),
  updated_at timestamptz NOT NULL,
  CHECK ((status = 'purged') = (purged_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS account_deletion_due_idx
  ON account_deletion_requests(content_purge_after, user_id)
  WHERE status = 'pending_content_purge';

ALTER TABLE webhook_inbox
  ADD COLUMN IF NOT EXISTS order_id text;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webhook_inbox_order_fk'
  ) THEN
    ALTER TABLE webhook_inbox ADD CONSTRAINT webhook_inbox_order_fk
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS webhook_inbox_order_idx
  ON webhook_inbox(order_id, created_at DESC)
  WHERE order_id IS NOT NULL;

ALTER TABLE quality_reviews
  ALTER COLUMN reading_id DROP NOT NULL;
ALTER TABLE quality_reviews
  DROP CONSTRAINT IF EXISTS quality_reviews_reading_id_fkey;
ALTER TABLE quality_reviews
  ADD CONSTRAINT quality_reviews_reading_id_fkey
  FOREIGN KEY (reading_id) REFERENCES readings(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION enforce_quality_review_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_reading record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT r.id, r.status, r.updated_at, c.user_id, c.lifecycle
      INTO v_reading
    FROM readings r
    JOIN casting_sessions c ON c.id = r.casting_session_id
    WHERE r.id = NEW.reading_id;

    IF v_reading.id IS NULL
      OR v_reading.user_id IS DISTINCT FROM NEW.user_id
      OR v_reading.status <> 'completed'
      OR v_reading.lifecycle <> 'revealed'
    THEN
      RAISE EXCEPTION 'QUALITY_REVIEW_NOT_DELIVERED'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF v_now > v_reading.updated_at + interval '7 days' THEN
      RAISE EXCEPTION 'QUALITY_REVIEW_WINDOW_CLOSED'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    NEW.status := 'submitted';
    NEW.response_due_at := third_business_day_from(v_now);
    NEW.supplemented_at := NULL;
    NEW.decided_at := NULL;
    NEW.compensation_batch_id := NULL;
    NEW.created_at := v_now;
    NEW.updated_at := v_now;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('approved', 'rejected') THEN
    IF NEW.status = OLD.status
      AND NEW.user_id = OLD.user_id
      AND NEW.response_due_at = OLD.response_due_at
      AND NEW.supplemented_at IS NOT DISTINCT FROM OLD.supplemented_at
      AND NEW.decided_at IS NOT DISTINCT FROM OLD.decided_at
      AND NEW.compensation_batch_id IS NOT DISTINCT FROM OLD.compensation_batch_id
      AND NEW.created_at = OLD.created_at
      AND NEW.reason IS NULL
      AND (NEW.reading_id IS NULL OR NEW.reading_id IS NOT DISTINCT FROM OLD.reading_id)
    THEN
      NEW.updated_at := v_now;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'QUALITY_REVIEW_TERMINAL'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW.status = 'supplementing' AND OLD.status = 'submitted' THEN
    IF OLD.supplemented_at IS NOT NULL OR v_now > OLD.created_at + interval '24 hours' THEN
      RAISE EXCEPTION 'QUALITY_REVIEW_SUPPLEMENT_CLOSED'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    NEW.supplemented_at := v_now;
  ELSIF NEW.status = 'supplementing' AND OLD.status <> 'supplementing' THEN
    RAISE EXCEPTION 'QUALITY_REVIEW_SUPPLEMENT_CLOSED'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW.status IN ('approved', 'rejected') AND OLD.status NOT IN ('approved', 'rejected') THEN
    NEW.decided_at := v_now;
  END IF;
  NEW.updated_at := v_now;
  RETURN NEW;
END
$$;

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
    IF NOT pg_try_advisory_xact_lock(hashtextextended(NEW.id || ':preview', 0)) THEN
      RAISE EXCEPTION 'CASTING_DELETE_RETRY'
        USING ERRCODE = '40001';
    END IF;
    IF NOT pg_try_advisory_xact_lock(hashtextextended(NEW.id || ':deep_reading', 0)) THEN
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

        IF v_reading.id IS NOT NULL AND v_reading.reservation_id IS NOT NULL THEN
          SELECT * INTO v_reservation
          FROM reservations
          WHERE id = v_reading.reservation_id
          FOR UPDATE;

          IF v_reservation.id IS NOT NULL AND v_reservation.status = 'reserved' THEN
            SELECT * INTO v_batch
            FROM entitlement_batches
            WHERE id = v_reservation.batch_id
            FOR UPDATE;

            IF v_batch.id IS NOT NULL THEN
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
                CASE WHEN v_expired THEN 'revoke' ELSE 'release' END,
                1,
                v_reading.id,
                v_reservation.id,
                'casting_deleted',
                v_now
              );
            END IF;
          END IF;
        END IF;

        IF v_reading.id IS NOT NULL THEN
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
