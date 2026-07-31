ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_reading_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_active_per_reading_idx
  ON reservations (reading_id)
  WHERE status = 'reserved';

CREATE INDEX IF NOT EXISTS reservations_reading_history_idx
  ON reservations (reading_id, created_at, id);
