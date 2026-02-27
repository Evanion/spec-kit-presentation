# Data Model: Audience Interaction

**Feature**: 001-audience-interaction
**Date**: 2026-02-27
**Source**: [spec.md](spec.md) Key Entities section

## Entities

### Session

Represents a single presentation event. Auto-created when the presenter first connects with a valid token.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique session identifier |
| `status` | `text` | NOT NULL, CHECK (`active`, `ended`) | Session lifecycle state |
| `current_slide` | `integer` | NOT NULL, default `1` | Presenter's current slide number |
| `presenter_token_hash` | `text` | NOT NULL | SHA-256 hash of the presenter secret token |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | When the session was created |
| `ended_at` | `timestamptz` | nullable | When the session was ended by the presenter |

**State transitions**: `active` → `ended` (one-way; no reactivation).

**Reset behavior**: Resets all child data (poll_votes, questions, question_votes) but preserves session row and poll definitions. `current_slide` resets to `1`.

**Indexes**:
- `idx_session_status` on `status` (filter active sessions)

---

### Poll

A pre-defined poll tied to a specific slide. Seeded from slide markdown when the session starts.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique poll identifier |
| `session_id` | `uuid` | FK → `session.id`, NOT NULL | Parent session |
| `slide_number` | `integer` | NOT NULL | Which slide this poll is attached to |
| `question` | `text` | NOT NULL, max 500 chars | Poll question text |
| `options` | `jsonb` | NOT NULL | Ordered array of option strings, e.g. `["Option A", "Option B"]` |
| `status` | `text` | NOT NULL, CHECK (`open`, `closed`), default `open` | Whether voting is allowed |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | When the poll was seeded |

**Constraints**:
- UNIQUE (`session_id`, `slide_number`) — one poll per slide per session.
- `options` must be a JSON array with 2-5 string elements.

**State transitions**: `open` → `closed` (one-way per session; reset re-opens).

**Indexes**:
- `idx_poll_session_slide` on (`session_id`, `slide_number`) — lookup poll by current slide

---

### PollVote

Records a single device's vote on a poll. One vote per device per poll (upsert on conflict).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique vote record |
| `poll_id` | `uuid` | FK → `poll.id`, NOT NULL | Which poll |
| `device_id` | `text` | NOT NULL | Anonymous device UUID from localStorage |
| `selected_option` | `integer` | NOT NULL | 0-based index into `poll.options` array |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | When the vote was first cast |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | When the vote was last changed |

**Constraints**:
- UNIQUE (`poll_id`, `device_id`) — one vote per device per poll. Edge Function uses `ON CONFLICT ... DO UPDATE` for vote changes.

**Indexes**:
- `idx_poll_vote_poll_id` on `poll_id` — aggregate votes per poll
- `idx_poll_vote_device` on (`poll_id`, `device_id`) — enforce uniqueness, fast upsert lookup

---

### Question

Audience-submitted question within a session. Sorted by net vote score.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique question identifier |
| `session_id` | `uuid` | FK → `session.id`, NOT NULL | Parent session |
| `device_id` | `text` | NOT NULL | Submitter's anonymous device UUID |
| `content` | `text` | NOT NULL, max 300 chars | Question text (plain text, sanitized) |
| `score` | `integer` | NOT NULL, default `0` | Net vote score (upvotes minus downvotes) |
| `is_answered` | `boolean` | NOT NULL, default `false` | Marked as answered by presenter |
| `is_hidden` | `boolean` | NOT NULL, default `false` | Hidden by presenter (excluded from audience feed) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | When the question was submitted |

**Indexes**:
- `idx_question_session_score` on (`session_id`, `score` DESC) — feed sorted by net votes
- `idx_question_session_visible` on (`session_id`) WHERE `is_hidden = false` — audience feed filter
- `idx_question_device` on (`session_id`, `device_id`) — rate limit check (count recent questions per device)

---

### QuestionVote

Records a single device's vote (up or down) on a question. One vote per device per question (toggle behavior).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique vote record |
| `question_id` | `uuid` | FK → `question.id`, NOT NULL | Which question |
| `device_id` | `text` | NOT NULL | Voter's anonymous device UUID |
| `direction` | `smallint` | NOT NULL, CHECK (`1`, `-1`) | `1` = upvote, `-1` = downvote |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | When the vote was cast |

**Constraints**:
- UNIQUE (`question_id`, `device_id`) — one vote per device per question.

**Toggle behavior**: If a device votes in the same direction again, the vote is deleted (toggle off). If the device votes in the opposite direction, the existing vote is updated.

**Score maintenance**: The Edge Function updates `question.score` by computing `SUM(direction)` from `question_votes` for that question after each vote change. This avoids race conditions from concurrent votes.

**Indexes**:
- `idx_question_vote_question_id` on `question_id` — aggregate votes per question
- `idx_question_vote_device` on (`question_id`, `device_id`) — enforce uniqueness, fast lookup

---

## Relationships

```text
Session 1──* Poll
Session 1──* Question
Poll    1──* PollVote
Question 1──* QuestionVote
```

All foreign keys use `ON DELETE CASCADE` — when a session is deleted, all child data is removed. However, the primary cleanup mechanism is the session reset operation (truncates child tables by session_id, not DELETE CASCADE).

## RLS Policies

All tables have RLS enabled. The `anon` role has SELECT-only access:

```sql
-- Applied to: session, poll, poll_votes, questions, question_votes
CREATE POLICY "anon_read" ON {table}
  FOR SELECT TO anon USING (true);

-- No INSERT/UPDATE/DELETE policies for anon.
-- All writes via Edge Functions using service_role (bypasses RLS).
```

For the `questions` table, the audience SELECT policy filters hidden questions:

```sql
CREATE POLICY "anon_read_visible_questions" ON questions
  FOR SELECT TO anon
  USING (is_hidden = false);
```

The presenter view (in Edge Functions or via `service_role` client) bypasses RLS and sees all questions including hidden ones.
