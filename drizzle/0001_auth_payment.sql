ALTER TABLE users
  ADD COLUMN name text,
  ADD COLUMN email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN image text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE sessions
  ADD COLUMN token text,
  ADD COLUMN ip_address text,
  ADD COLUMN user_agent text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
UPDATE sessions SET token = id WHERE token IS NULL;
ALTER TABLE sessions ALTER COLUMN token SET NOT NULL;
CREATE UNIQUE INDEX sessions_token_unique_idx ON sessions(token);

CREATE TABLE accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  id_token text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, account_id)
);
CREATE INDEX accounts_user_idx ON accounts(user_id);

CREATE TABLE verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verifications_identifier_idx ON verifications(identifier);

ALTER TABLE entitlement_batches
  ADD COLUMN order_id text REFERENCES orders(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX entitlement_batch_order_unique_idx
  ON entitlement_batches(order_id)
  WHERE order_id IS NOT NULL;

CREATE TABLE refunds (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider_refund_id text NOT NULL UNIQUE,
  amount_usd numeric(10,2) NOT NULL CHECK (amount_usd >= 0),
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE disputes (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider_dispute_id text NOT NULL UNIQUE,
  status text NOT NULL,
  reason_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
