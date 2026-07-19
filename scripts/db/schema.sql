CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  seeds JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parties_updated_at_idx ON parties (updated_at DESC);
