# Edge Function Contracts: Audience Interaction

**Feature**: 001-audience-interaction
**Date**: 2026-02-27
**Base URL**: `{SUPABASE_URL}/functions/v1`

## Common Patterns

### Authentication

- **Audience endpoints**: No JWT required (`verify_jwt = false` in config.toml). Device identified by `device_id` in request body.
- **Presenter endpoints**: Require `Authorization: Bearer {presenter_token}` header. Token is validated against `session.presenter_token_hash` (SHA-256).

### CORS

All endpoints return these headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
```

All endpoints handle `OPTIONS` preflight with `200 ok`.

### Error Responses

Standard error format:
```json
{
  "error": "Human-readable error message"
}
```

Status codes:
- `400` — Invalid input (missing fields, validation failure)
- `401` — Missing or invalid presenter token
- `403` — Action not allowed (session ended, poll closed)
- `429` — Rate limit exceeded
- `500` — Server error

Rate limit responses include headers:
```
X-RateLimit-Limit: {max}
X-RateLimit-Remaining: {remaining}
X-RateLimit-Reset: {unix_timestamp}
```

---

## Presenter Endpoints

### POST `/session`

Create or retrieve the active session. Called when the presenter loads the deck.

**Auth**: Presenter token required.

**Request**:
```json
{
  "polls": [
    {
      "slide_number": 5,
      "question": "What's your AI planning approach?",
      "options": ["I spec my kits", "Plan mode, more like pain mode", "WTF AI can plan?"]
    }
  ]
}
```

**Response** (`200`):
```json
{
  "session": {
    "id": "uuid",
    "status": "active",
    "current_slide": 1,
    "created_at": "2026-02-27T10:00:00Z"
  },
  "polls": [
    {
      "id": "uuid",
      "slide_number": 5,
      "question": "What's your AI planning approach?",
      "options": ["I spec my kits", "Plan mode, more like pain mode", "WTF AI can plan?"],
      "status": "open"
    }
  ]
}
```

**Behavior**: If an active session already exists for this presenter token, returns it (idempotent). Polls are seeded only on first creation; subsequent calls return existing polls.

---

### POST `/session/end`

End the active session. No further submissions or votes accepted.

**Auth**: Presenter token required.

**Request**: Empty body or `{}`.

**Response** (`200`):
```json
{
  "session": {
    "id": "uuid",
    "status": "ended",
    "ended_at": "2026-02-27T11:30:00Z"
  }
}
```

---

### POST `/session/reset`

Reset the active session: clear all poll votes, questions, and question votes. Preserve poll definitions and session configuration. Reset `current_slide` to 1.

**Auth**: Presenter token required.

**Request**: Empty body or `{}`.

**Response** (`200`):
```json
{
  "session": {
    "id": "uuid",
    "status": "active",
    "current_slide": 1
  },
  "cleared": {
    "poll_votes": 42,
    "questions": 15,
    "question_votes": 87
  }
}
```

---

### POST `/sync-slide`

Broadcast the current slide number to all connected audience devices and update the session record.

**Auth**: Presenter token required.

**Request**:
```json
{
  "slide_number": 5
}
```

**Response** (`200`):
```json
{
  "slide_number": 5,
  "poll": {
    "id": "uuid",
    "question": "What's your AI planning approach?",
    "options": ["I spec my kits", "Plan mode, more like pain mode", "WTF AI can plan?"],
    "status": "open"
  }
}
```

**Behavior**: Updates `session.current_slide` in DB. Sends a Realtime Broadcast event on channel `presentation-live` with event `slide-change` and payload `{ slide: N }`. If the target slide has a poll, returns the poll data. If not, `poll` is `null`.

---

### POST `/manage-poll`

Open or close a poll.

**Auth**: Presenter token required.

**Request**:
```json
{
  "poll_id": "uuid",
  "action": "close"
}
```

**Response** (`200`):
```json
{
  "poll": {
    "id": "uuid",
    "status": "closed"
  }
}
```

**Actions**: `"open"` | `"close"`.

---

### POST `/manage-question`

Mark a question as answered or hide/unhide it.

**Auth**: Presenter token required.

**Request**:
```json
{
  "question_id": "uuid",
  "action": "answer"
}
```

**Response** (`200`):
```json
{
  "question": {
    "id": "uuid",
    "is_answered": true,
    "is_hidden": false
  }
}
```

**Actions**: `"answer"` | `"unanswer"` | `"hide"` | `"unhide"`.

---

## Audience Endpoints

### POST `/submit-vote`

Cast or change a poll vote.

**Auth**: None (audience endpoint).
**Rate limit**: 30 votes per device per minute.

**Request**:
```json
{
  "poll_id": "uuid",
  "device_id": "uuid-from-localstorage",
  "selected_option": 1
}
```

**Response** (`200`):
```json
{
  "vote": {
    "poll_id": "uuid",
    "selected_option": 1,
    "changed": false
  }
}
```

`changed: true` if the vote replaced a previous selection.

**Errors**:
- `403` `"Poll is closed"` — poll status is `closed`
- `403` `"Session has ended"` — session status is `ended`
- `400` `"Invalid option index"` — `selected_option` out of range
- `429` `"Slow down — try again in a moment"` — rate limit exceeded

---

### POST `/submit-question`

Submit a new question.

**Auth**: None (audience endpoint).
**Rate limit**: 3 questions per device per minute.

**Request**:
```json
{
  "session_id": "uuid",
  "device_id": "uuid-from-localstorage",
  "content": "How does spec-kit handle requirement changes?"
}
```

**Response** (`201`):
```json
{
  "question": {
    "id": "uuid",
    "content": "How does spec-kit handle requirement changes?",
    "score": 0,
    "created_at": "2026-02-27T10:15:00Z"
  }
}
```

**Validation**:
- `content` must be 1-300 characters (trimmed).
- Rejected if content consists solely of repeated characters, excessive whitespace, or zero meaningful content.
- All content stored as plain text (no HTML interpretation).

**Errors**:
- `400` `"Question too long"` — exceeds 300 characters
- `400` `"Question cannot be empty"` — empty after trimming
- `400` `"Invalid question content"` — spam/repeated character detection
- `403` `"Session has ended"` — session status is `ended`
- `429` `"Slow down — try again in a moment"` — rate limit exceeded

---

### POST `/vote-question`

Upvote or downvote a question.

**Auth**: None (audience endpoint).
**Rate limit**: 30 votes per device per minute (shared with poll votes).

**Request**:
```json
{
  "question_id": "uuid",
  "device_id": "uuid-from-localstorage",
  "direction": 1
}
```

**Response** (`200`):
```json
{
  "vote": {
    "question_id": "uuid",
    "direction": 1,
    "action": "created"
  },
  "question": {
    "id": "uuid",
    "score": 5
  }
}
```

`action`: `"created"` | `"changed"` | `"removed"` (toggled off).

**Behavior**:
- Same direction as existing vote → remove vote (toggle off), `action: "removed"`
- Opposite direction from existing vote → update vote, `action: "changed"`
- No existing vote → create vote, `action: "created"`
- After vote change, recomputes `question.score` as `SUM(direction)` from `question_votes`.

**Errors**:
- `400` `"Invalid direction"` — must be `1` or `-1`
- `403` `"Session has ended"` — session status is `ended`
- `429` — rate limit exceeded (silently throttled per spec)

---

## Realtime Channels

### Broadcast Channel: `presentation-live`

**Purpose**: Ephemeral slide-change notifications (no database).

**Event**: `slide-change`
**Payload**:
```json
{
  "slide": 5,
  "timestamp": 1740650400000
}
```

**Sender**: Presenter (via `sync-slide` Edge Function or directly from presenter client).
**Receivers**: All audience devices subscribed to this channel.

### Postgres Changes: `session-data`

**Purpose**: Live data updates for poll votes, questions, and question votes.

**Subscriptions**:

| Table | Events | Filter |
|-------|--------|--------|
| `poll_votes` | INSERT, UPDATE | `poll_id=eq.{active_poll_id}` |
| `questions` | INSERT, UPDATE | `session_id=eq.{session_id}` |
| `question_votes` | INSERT, UPDATE, DELETE | (no filter — client-side aggregation) |
| `polls` | UPDATE | `session_id=eq.{session_id}` |
| `sessions` | UPDATE | `id=eq.{session_id}` |

**Note**: The audience client filters `questions` changes client-side to exclude `is_hidden = true` rows (RLS policy also enforces this at the DB level for initial SELECT, but Realtime events for UPDATE may include the hidden flag change).
