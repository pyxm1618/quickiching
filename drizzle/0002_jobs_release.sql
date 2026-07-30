ALTER TABLE generation_jobs
  ADD COLUMN workflow_run_id text,
  ADD COLUMN worker_id text,
  ADD COLUMN snapshot_encryption_key_version text,
  ADD COLUMN error_code text;

CREATE TABLE generation_attempts (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  generation_epoch integer NOT NULL CHECK (generation_epoch > 0),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  provider_request_id text,
  model_id text NOT NULL,
  prompt_version text NOT NULL,
  schema_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  estimated_cost_micros bigint CHECK (estimated_cost_micros IS NULL OR estimated_cost_micros >= 0),
  error_class text,
  error_code text,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  UNIQUE (job_id, generation_epoch, attempt_number)
);
CREATE INDEX generation_attempts_job_idx
  ON generation_attempts(job_id, generation_epoch, attempt_number);

CREATE TABLE rate_limit_buckets (
  bucket_key text NOT NULL,
  window_started_at timestamptz NOT NULL,
  window_expires_at timestamptz NOT NULL,
  used integer NOT NULL CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_key, window_started_at)
);
CREATE INDEX rate_limit_buckets_expiry_idx ON rate_limit_buckets(window_expires_at);

CREATE TABLE audit_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  actor_id text,
  entity_type text,
  entity_id text,
  request_id text,
  safe_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_entity_idx ON audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX audit_events_request_idx ON audit_events(request_id) WHERE request_id IS NOT NULL;

CREATE TABLE product_events (
  id text PRIMARY KEY,
  event_name text NOT NULL,
  user_id text,
  anonymous_session_hash text,
  casting_session_id text,
  safe_properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_events_name_idx ON product_events(event_name, created_at DESC);

CREATE INDEX generation_jobs_timeout_idx
  ON generation_jobs(timeout_at, status)
  WHERE status IN ('queued', 'running');
CREATE INDEX generation_jobs_outbox_idx
  ON generation_jobs(workflow_run_id, status);
