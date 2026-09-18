CREATE TABLE IF NOT EXISTS moods (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  persona     TEXT        NOT NULL,
  mood        TEXT        NOT NULL,
  intensity   SMALLINT    NOT NULL CHECK (intensity BETWEEN 1 AND 5),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moods_user_created_idx ON moods (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memories (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  fact        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_user_created_idx ON memories (user_id, created_at DESC);
