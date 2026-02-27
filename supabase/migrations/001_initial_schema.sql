-- 001_initial_schema.sql
-- Audience Interaction: sessions, polls, questions, votes

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  current_slide integer NOT NULL DEFAULT 1,
  presenter_token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  slide_number integer NOT NULL,
  question text NOT NULL CHECK (char_length(question) <= 500),
  options jsonb NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, slide_number)
);

CREATE TABLE poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  selected_option integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, device_id)
);

CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 300),
  score integer NOT NULL DEFAULT 0,
  is_answered boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE question_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  direction smallint NOT NULL CHECK (direction IN (1, -1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, device_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_session_status ON sessions (status);

CREATE INDEX idx_poll_session_slide ON polls (session_id, slide_number);

CREATE INDEX idx_poll_vote_poll_id ON poll_votes (poll_id);
CREATE INDEX idx_poll_vote_device ON poll_votes (poll_id, device_id);

CREATE INDEX idx_question_session_score ON questions (session_id, score DESC);
CREATE INDEX idx_question_session_visible ON questions (session_id) WHERE is_hidden = false;
CREATE INDEX idx_question_device ON questions (session_id, device_id);

CREATE INDEX idx_question_vote_question_id ON question_votes (question_id);
CREATE INDEX idx_question_vote_device ON question_votes (question_id, device_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_votes ENABLE ROW LEVEL SECURITY;

-- Anon read-all for sessions, polls, poll_votes, question_votes
CREATE POLICY "anon_read" ON sessions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON polls FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON poll_votes FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON question_votes FOR SELECT TO anon USING (true);

-- Questions: anon can only see non-hidden
CREATE POLICY "anon_read_visible_questions" ON questions
  FOR SELECT TO anon
  USING (is_hidden = false);

-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
ALTER PUBLICATION supabase_realtime ADD TABLE question_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE polls;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
