ALTER TABLE generation_jobs
  ADD COLUMN reservation_id text REFERENCES reservations(id) ON DELETE SET NULL,
  ADD COLUMN workflow_run_id text;

CREATE TABLE generation_attempts (
  job_id text NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  generation_epoch integer NOT NULL CHECK (generation_epoch >= 0),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  provider_request_id text,
  model_id text NOT NULL,
  prompt_version text NOT NULL,
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  total_tokens integer CHECK (total_tokens IS NULL OR total_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, generation_epoch, attempt_number)
);

CREATE UNIQUE INDEX generation_job_active_unique_idx
  ON generation_jobs(casting_session_id, job_type)
  WHERE status IN ('queued', 'running');

CREATE UNIQUE INDEX outbox_generation_once_idx
  ON outbox(topic, aggregate_id)
  WHERE topic = 'generation.requested';
