-- Per-persona memory: each companion keeps its own context.
ALTER TABLE memories ADD COLUMN IF NOT EXISTS persona TEXT;
CREATE INDEX IF NOT EXISTS memories_user_persona_idx ON memories (user_id, persona, created_at DESC);
