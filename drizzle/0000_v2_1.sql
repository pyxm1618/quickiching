CREATE TYPE casting_lifecycle AS ENUM (
  'draft', 'casting', 'awaiting_reveal', 'revealed', 'expired', 'cancelled',
  'discarded_duplicate', 'emergency_blocked', 'user_deleted'
);
CREATE TYPE risk_status AS ENUM (
  'not_checked', 'allowed', 'professional_decision_blocked', 'needs_clarification', 'emergency_blocked'
);
CREATE TYPE preview_status AS ENUM ('not_started', 'queued', 'generating', 'completed', 'failed', 'blocked');
CREATE TYPE reading_status AS ENUM ('not_started', 'reserved', 'queued', 'generating', 'validating', 'completed', 'failed', 'blocked');
CREATE TYPE reservation_status AS ENUM ('reserved', 'consumed', 'released', 'expired');
CREATE TYPE quality_review_status AS ENUM ('not_started', 'submitted', 'supplementing', 'in_review', 'approved', 'rejected');
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'refunded', 'disputed');
CREATE TYPE job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'timed_out');

CREATE TABLE users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE casting_sessions (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  anonymous_session_hash text,
  anonymous_hash_key_version text,
  method text NOT NULL CHECK (method IN ('three_coin', 'yarrow_stalk', 'mei_hua_current_time')),
  lifecycle casting_lifecycle NOT NULL DEFAULT 'draft',
  risk_status risk_status NOT NULL DEFAULT 'not_checked',
  scene text NOT NULL CHECK (scene IN ('career', 'relationships', 'wealth', 'timing', 'choices', 'personal_growth', 'other')),
  interpretation_goal text NOT NULL CHECK (interpretation_goal IN (
    'what_do_i_need_to_see_clearly', 'what_is_blocking_this_situation',
    'what_should_i_understand_about_my_options', 'what_should_i_pay_attention_to_next',
    'is_the_timing_favorable'
  )),
  current_question_version_id text,
  question_fingerprint text,
  fingerprint_key_version text,
  algorithm_version text NOT NULL,
  first_irreversible_step_at timestamptz,
  casting_expires_at timestamptz,
  completed_at timestamptz,
  reveal_expires_at timestamptz,
  revealed_at timestamptz,
  duplicate_of_casting_id text REFERENCES casting_sessions(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR anonymous_session_hash IS NOT NULL),
  CHECK ((question_fingerprint IS NULL) = (fingerprint_key_version IS NULL)),
  CHECK ((deleted_at IS NULL) = (purge_after IS NULL))
);
CREATE INDEX casting_sessions_user_idx ON casting_sessions(user_id, created_at DESC);
CREATE INDEX casting_sessions_anonymous_idx ON casting_sessions(anonymous_session_hash);
CREATE UNIQUE INDEX casting_active_user_once_idx ON casting_sessions(user_id)
  WHERE user_id IS NOT NULL AND lifecycle IN ('draft', 'casting', 'awaiting_reveal');
CREATE UNIQUE INDEX casting_active_anonymous_once_idx ON casting_sessions(anonymous_session_hash)
  WHERE anonymous_session_hash IS NOT NULL AND lifecycle IN ('draft', 'casting', 'awaiting_reveal');

CREATE TABLE login_intents (
  id text PRIMARY KEY,
  casting_session_id text NOT NULL REFERENCES casting_sessions(id) ON DELETE CASCADE,
  anonymous_session_hash text NOT NULL,
  nonce_hash text NOT NULL,
  nonce_key_version text NOT NULL,
  allowed_callback_path text NOT NULL CHECK (allowed_callback_path LIKE '/result/%'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_intents_casting_idx ON login_intents(casting_session_id);
CREATE INDEX login_intents_expiry_idx ON login_intents(expires_at) WHERE consumed_at IS NULL;

CREATE TABLE question_versions (
  id text PRIMARY KEY,
  casting_session_id text NOT NULL REFERENCES casting_sessions(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  ciphertext text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  encryption_key_version text NOT NULL,
  created_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (casting_session_id, version_number)
);
ALTER TABLE casting_sessions
  ADD CONSTRAINT casting_current_question_fk
  FOREIGN KEY (current_question_version_id) REFERENCES question_versions(id) ON DELETE SET NULL;

CREATE TABLE casting_risk_decisions (
  casting_session_id text PRIMARY KEY REFERENCES casting_sessions(id) ON DELETE CASCADE,
  rule_version text NOT NULL,
  matched_rule_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason_code text NOT NULL,
  status risk_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(matched_rule_codes) = 'array')
);

CREATE TABLE casting_steps (
  id text PRIMARY KEY,
  casting_session_id text NOT NULL REFERENCES casting_sessions(id) ON DELETE CASCADE,
  step_kind text NOT NULL,
  line_index integer NOT NULL CHECK (line_index BETWEEN 0 AND 5),
  change_index integer CHECK (change_index BETWEEN 0 AND 2),
  raw_record jsonb NOT NULL,
  line_value integer CHECK (line_value IN (6, 7, 8, 9)),
  algorithm_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX casting_step_once_idx
  ON casting_steps(casting_session_id, step_kind, line_index, COALESCE(change_index, -1));
CREATE INDEX casting_steps_casting_idx ON casting_steps(casting_session_id, line_index, change_index);

CREATE TABLE cast_results (
  casting_session_id text PRIMARY KEY REFERENCES casting_sessions(id) ON DELETE CASCADE,
  line_values jsonb NOT NULL,
  primary_hexagram_number integer NOT NULL CHECK (primary_hexagram_number BETWEEN 1 AND 64),
  moving_line_positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  relating_hexagram_number integer CHECK (relating_hexagram_number BETWEEN 1 AND 64),
  method_calculation jsonb NOT NULL,
  result_hmac text NOT NULL,
  algorithm_version text NOT NULL,
  classic_mapping_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(line_values) = 'array' AND jsonb_array_length(line_values) = 6),
  CHECK (jsonb_typeof(moving_line_positions) = 'array')
);

CREATE TABLE question_locks (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_fingerprint text NOT NULL,
  fingerprint_key_version text NOT NULL,
  winning_casting_id text NOT NULL REFERENCES casting_sessions(id) ON DELETE CASCADE,
  locked_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_fingerprint, fingerprint_key_version)
);
CREATE INDEX question_locks_active_user_idx ON question_locks(user_id, locked_until DESC);

CREATE TABLE previews (
  id text PRIMARY KEY,
  casting_session_id text NOT NULL UNIQUE REFERENCES casting_sessions(id) ON DELETE CASCADE,
  status preview_status NOT NULL DEFAULT 'not_started',
  relevance_statement text,
  schema_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'completed') = (relevance_statement IS NOT NULL))
);

CREATE TABLE readings (
  id text PRIMARY KEY,
  casting_session_id text NOT NULL UNIQUE REFERENCES casting_sessions(id) ON DELETE CASCADE,
  status reading_status NOT NULL DEFAULT 'not_started',
  reservation_id text,
  report jsonb,
  schema_version text NOT NULL,
  generation_epoch integer NOT NULL DEFAULT 0 CHECK (generation_epoch >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'completed' OR report IS NOT NULL)
);

CREATE TABLE entitlement_batches (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  amount_usd numeric(10,2) NOT NULL CHECK (amount_usd >= 0),
  quantity_total integer NOT NULL CHECK (quantity_total >= 0),
  quantity_available integer NOT NULL CHECK (quantity_available >= 0),
  quantity_reserved integer NOT NULL CHECK (quantity_reserved >= 0),
  quantity_consumed integer NOT NULL CHECK (quantity_consumed >= 0),
  quantity_revoked integer NOT NULL CHECK (quantity_revoked >= 0),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity_available + quantity_reserved + quantity_consumed + quantity_revoked = quantity_total)
);
CREATE INDEX entitlement_batches_fifo_idx ON entitlement_batches(user_id, expires_at, created_at)
  WHERE quantity_available > 0;

CREATE TABLE entitlement_ledger (
  id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES entitlement_batches(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('grant', 'reserve', 'consume', 'release', 'expire', 'revoke', 'compensate')),
  quantity integer NOT NULL CHECK (quantity > 0),
  reading_id text,
  reservation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entitlement_ledger_batch_idx ON entitlement_ledger(batch_id, created_at);

CREATE TABLE reservations (
  id text PRIMARY KEY,
  reading_id text NOT NULL UNIQUE REFERENCES readings(id) ON DELETE CASCADE,
  batch_id text NOT NULL REFERENCES entitlement_batches(id) ON DELETE RESTRICT,
  status reservation_status NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE readings
  ADD CONSTRAINT readings_reservation_fk
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;

CREATE TABLE orders (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id text NOT NULL,
  amount_usd numeric(10,2) NOT NULL CHECK (amount_usd >= 0),
  currency text NOT NULL,
  request_id text NOT NULL UNIQUE,
  provider_checkout_id text UNIQUE,
  status order_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON orders(user_id, created_at DESC);

CREATE TABLE quality_reviews (
  id text PRIMARY KEY,
  reading_id text NOT NULL UNIQUE REFERENCES readings(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status quality_review_status NOT NULL DEFAULT 'submitted',
  reason text,
  response_due_at timestamptz NOT NULL,
  supplemented_at timestamptz,
  decided_at timestamptz,
  compensation_batch_id text REFERENCES entitlement_batches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('approved', 'rejected') OR decided_at IS NOT NULL)
);

CREATE TABLE generation_jobs (
  id text PRIMARY KEY,
  casting_session_id text NOT NULL REFERENCES casting_sessions(id) ON DELETE CASCADE,
  reading_id text REFERENCES readings(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('preview', 'deep_reading', 'output_review')),
  status job_status NOT NULL DEFAULT 'queued',
  generation_epoch integer NOT NULL DEFAULT 0 CHECK (generation_epoch >= 0),
  snapshot jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  timeout_at timestamptz NOT NULL,
  claimed_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX generation_jobs_claim_idx ON generation_jobs(status, available_at, created_at);
CREATE UNIQUE INDEX generation_job_epoch_once_idx
  ON generation_jobs(casting_session_id, job_type, generation_epoch);

CREATE TABLE outbox (
  id text PRIMARY KEY,
  topic text NOT NULL,
  aggregate_id text,
  payload jsonb NOT NULL,
  dispatched_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_dispatch_idx ON outbox(dispatched_at, available_at, created_at);

CREATE TABLE webhook_inbox (
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature_verified_at timestamptz NOT NULL,
  processed_at timestamptz,
  processing_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);
