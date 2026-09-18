-- Bridge agent: real people the companion encourages the user to reach out to.
CREATE TABLE IF NOT EXISTS nudges (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  person      TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  persona     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nudges_user_created_idx ON nudges (user_id, created_at DESC);
