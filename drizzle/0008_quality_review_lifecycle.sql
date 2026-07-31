CREATE TABLE IF NOT EXISTS business_calendar_holidays (
  holiday_date date PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE entitlement_batches
  ADD COLUMN IF NOT EXISTS quality_review_id text;
CREATE UNIQUE INDEX IF NOT EXISTS entitlement_batches_quality_review_once_idx
  ON entitlement_batches (quality_review_id)
  WHERE quality_review_id IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entitlement_batches_quality_review_fk'
  ) THEN
    ALTER TABLE entitlement_batches ADD CONSTRAINT entitlement_batches_quality_review_fk
      FOREIGN KEY (quality_review_id) REFERENCES quality_reviews(id) ON DELETE RESTRICT;
  END IF;
END
$$;

ALTER TABLE entitlement_ledger
  ADD COLUMN IF NOT EXISTS quality_review_id text;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entitlement_ledger_quality_review_fk'
  ) THEN
    ALTER TABLE entitlement_ledger ADD CONSTRAINT entitlement_ledger_quality_review_fk
      FOREIGN KEY (quality_review_id) REFERENCES quality_reviews(id) ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION third_business_day_from(p_started_at timestamptz)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT candidate_day
    + (p_started_at - date_trunc('day', p_started_at))
  FROM (
    SELECT day AS candidate_day
    FROM generate_series(
      date_trunc('day', p_started_at) + interval '1 day',
      date_trunc('day', p_started_at) + interval '21 days',
      interval '1 day'
    ) AS day
    WHERE extract(isodow FROM day) < 6
      AND NOT EXISTS (
        SELECT 1 FROM business_calendar_holidays h
        WHERE h.holiday_date = day::date
      )
    ORDER BY day
    LIMIT 1 OFFSET 2
  ) business_day
$$;

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

DROP TRIGGER IF EXISTS quality_review_lifecycle_guard ON quality_reviews;
CREATE TRIGGER quality_review_lifecycle_guard
BEFORE INSERT OR UPDATE ON quality_reviews
FOR EACH ROW
EXECUTE FUNCTION enforce_quality_review_lifecycle();
