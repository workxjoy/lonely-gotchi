-- Call logs + what the summarizer agent learned from each call.
CREATE TABLE IF NOT EXISTS calls (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT        NOT NULL,
  persona      TEXT        NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ,
  summary      TEXT,
  what_helped  TEXT
);
CREATE INDEX IF NOT EXISTS calls_user_started_idx ON calls (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS call_messages (
  id          SERIAL PRIMARY KEY,
  call_id     INTEGER     NOT NULL REFERENCES calls (id) ON DELETE CASCADE,
  position    INTEGER     NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  text        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_messages_call_idx ON call_messages (call_id, position);
