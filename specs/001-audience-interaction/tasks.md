# Tasks: Audience Interaction

**Input**: Design documents from `/specs/001-audience-interaction/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/edge-functions.md, quickstart.md

**Tests**: No automated tests requested. Manual integration testing per quickstart.md.

**Organization**: Tasks grouped by user story. US4 (Anti-Abuse) protections are woven into foundational infrastructure and each Edge Function; a dedicated verification phase confirms all acceptance scenarios.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install dependencies, initialize Supabase project, configure build tooling.

- [x] T001 Install npm dependencies (@supabase/supabase-js, qrcode-svg) in package.json
- [x] T002 Initialize Supabase project structure by running `npx supabase init` — creates supabase/ directory with config.toml and seed.sql
- [x] T003 [P] Create .env.local.example with placeholder values (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_PRESENTER_TOKEN, VITE_AUDIENCE_URL) at project root
- [x] T004 [P] Update vite.config.ts to add multi-page entry point for pages/audience/index.html alongside the default Slidev entry
- [x] T005 [P] Add .env.local and supabase/.temp/ to .gitignore

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, shared utilities, Edge Function helpers, core composables. MUST complete before any user story.

**CRITICAL**: No user story work can begin until this phase is complete.

### Database & Backend Infrastructure

- [x] T006 Create database migration with all tables (sessions, polls, poll_votes, questions, question_votes), constraints, RLS policies, and indexes per data-model.md in supabase/migrations/001_initial_schema.sql
- [x] T007 Configure supabase/config.toml — set verify_jwt=false for all audience-facing Edge Functions (submit-vote, submit-question, vote-question), keep verify_jwt=true or use custom auth for presenter functions

### Shared Utilities

- [x] T008 [P] Create TypeScript interfaces for all entities (Session, Poll, PollVote, Question, QuestionVote) and API request/response types per data-model.md in lib/types.ts
- [x] T009 [P] Create shared constants (SUPABASE_URL/ANON_KEY from env, MAX_QUESTION_LENGTH=300, RATE_LIMIT_QUESTIONS=3, RATE_LIMIT_VOTES=30, rate window=60s) in lib/constants.ts
- [x] T010 [P] Create content validation utilities — validateQuestionContent(text): checks length 1-300, rejects repeated chars, excessive whitespace, empty after trim; returns { valid, error } in lib/validation.ts
- [x] T010a [P] Create poll configuration file — single source of truth mapping slide numbers to poll definitions (question string + options array). Used by useSession to seed polls via POST /session and referenced by poll slides in slides.md. Export as typed array of { slideNumber, question, options } in lib/poll-config.ts

### Edge Function Shared Helpers

- [x] T011 [P] Create CORS headers helper — corsHeaders object and handleCors(req) that returns OPTIONS response per contracts/edge-functions.md in supabase/functions/_shared/cors.ts
- [x] T012 [P] Create Supabase admin client factory — createAdminClient() using SUPABASE_SERVICE_ROLE_KEY env var in supabase/functions/_shared/supabase.ts
- [x] T013 [P] Create Upstash rate limiter factory — createRateLimiter(prefix, limit, window) using UPSTASH_REDIS_REST_URL/TOKEN env vars, returns Ratelimit instance. Create two named limiters: `questions` (3/min/device) and `votes` (30/min/device, **shared** across submit-vote and vote-question per FR-013 — both functions must use the same "votes" prefix so poll votes and question votes count toward a single 30/min bucket) in supabase/functions/_shared/ratelimit.ts

### Core Composables

- [x] T014 Create useSupabase composable — Supabase client singleton using VITE_SUPABASE_URL/ANON_KEY, reactive connection state (connected/disconnected/reconnecting), auto-reconnect handling in composables/useSupabase.ts
- [x] T015 [P] Create useDeviceId composable — returns persistent UUID from localStorage via crypto.randomUUID(), with sessionStorage fallback in composables/useDeviceId.ts
- [x] T016 [P] Create usePresenterAuth composable — extracts token from URL query param (?token=), persists to localStorage, provides isPresenter computed ref and getAuthHeaders() helper in composables/usePresenterAuth.ts

### Session Edge Function

- [x] T017 Implement session Edge Function — POST /session (create or return active session, seed polls from request body), POST /session/end (set status=ended), POST /session/reset (clear poll_votes, questions, question_votes; reset current_slide to 1; preserve poll definitions). All three actions require presenter token auth. Per contracts/edge-functions.md in supabase/functions/session/index.ts

### Shared UI Components

- [x] T018 [P] Create ConnectionStatus.vue component — shows "Connection lost — reconnecting..." overlay when useSupabase reports disconnected state, auto-hides when reconnected. Styled with Regent brand colors in components/ConnectionStatus.vue

**Checkpoint**: Foundation ready — database deployed, Edge Function helpers in place, composables available. User story implementation can now begin.

---

## Phase 3: User Story 1 — Audience Joins via QR Code and Sees Contextual Interactions (Priority: P1) MVP

**Goal**: Audience scans QR code on a slide, opens a mobile participation page. The page auto-updates based on the presenter's current slide (shows poll when on poll slide, question feed otherwise). No login required.

**Independent Test**: Scan the QR code on a phone, verify the page loads. Change slides on the presenter — verify the audience page reflects the current slide context within 2 seconds. Disconnect backend — verify "Connection lost" message appears.

### Implementation

- [x] T019 [P] [US1] Create QrCode.vue component — uses qrcode-svg with Regent colors (#DADCF1 on transparent), props: url, size, color, background. Uses svg-viewbox container with join=true. Renders via v-html in components/QrCode.vue
- [x] T020 [US1] Implement sync-slide Edge Function — validates presenter token, updates session.current_slide in DB, sends Realtime Broadcast event on channel "presentation-live" with event "slide-change" and payload { slide: N }. Returns poll data if target slide has a poll per contracts/edge-functions.md in supabase/functions/sync-slide/index.ts
- [x] T021 [US1] Create useSlideSync composable — for presenter: watches slide changes (useNav().currentPage) and calls sync-slide endpoint; for audience: subscribes to Broadcast channel "presentation-live" and exposes reactive currentSlide ref. Handles late-join by fetching session.current_slide from DB on connect in composables/useSlideSync.ts
- [x] T022 [US1] Create useSession composable — on presenter load: calls POST /session with poll definitions from lib/poll-config.ts (a shared config file that maps slide numbers to poll question + options arrays, used as single source of truth for both session seeding and slide frontmatter) to create/retrieve session; exposes reactive session state (id, status, current_slide); provides endSession() and resetSession() methods in composables/useSession.ts
- [x] T023 [US1] Create audience page HTML entry point — minimal HTML shell with viewport meta for mobile, loads main.ts in pages/audience/index.html
- [x] T024 [US1] Create audience page Vue app bootstrap — createApp with Supabase plugin, mounts App.vue in pages/audience/main.ts
- [x] T025 [US1] Create audience App.vue — root component that: fetches active session on mount, subscribes to slide-sync Broadcast, shows StatusMessage when no session/disconnected, conditionally renders poll or question feed based on current slide context in pages/audience/App.vue
- [x] T026 [P] [US1] Create StatusMessage.vue — shows contextual messages: "Presentation hasn't started yet", "Connection lost — reconnecting...", "Presentation has ended — thanks for joining!". Props: type (waiting/disconnected/ended) in pages/audience/components/StatusMessage.vue
- [x] T027 [US1] Add QR code slide to slides.md — uses QrCode component with VITE_AUDIENCE_URL, centered layout, descriptive text "Scan to join"
- [x] T028 [US1] Integrate presenter-side session init and slide sync — on Slidev app mount with valid presenter token: call useSession to create session with poll definitions from lib/poll-config.ts, call useSlideSync to start broadcasting slide changes on navigation. Include ConnectionStatus component in global-top.vue for presenter

**Checkpoint**: Audience can scan QR code, see the participation page, and the page reflects the presenter's current slide. MVP is functional.

---

## Phase 4: User Story 2 — Presenter Runs a Live Poll (Priority: P2)

**Goal**: Poll appears on audience devices when presenter reaches a poll slide. Audience votes via mobile. Presenter's slide shows live-updating bar chart. Poll can be closed.

**Independent Test**: Navigate to poll slide — poll appears on audience page. Vote from phone — bar chart updates on presenter slide within 2 seconds. Vote again — previous vote replaced. Close poll — "Poll closed" shown on audience.

### Implementation

- [x] T029 [P] [US2] Implement submit-vote Edge Function — validates poll exists and is open, session is active, selected_option is in range. Upserts poll_vote (ON CONFLICT poll_id+device_id DO UPDATE). Applies rate limiting using shared "votes" limiter from T013 (30 votes/min/device, shared bucket with vote-question). Returns { vote, changed } per contracts/edge-functions.md in supabase/functions/submit-vote/index.ts
- [x] T030 [P] [US2] Implement manage-poll Edge Function — validates presenter token. Accepts actions: "open", "close". Updates poll.status. Per contracts/edge-functions.md in supabase/functions/manage-poll/index.ts
- [x] T031 [US2] Create PollResults.vue component — live-updating horizontal bar chart for presenter slide. Subscribes to Realtime postgres_changes on poll_votes (filtered by poll_id). Computes vote counts per option. Styled with Regent brand colors (#0099CC, #3FCDFA). Shows "Poll unavailable" when backend unreachable. Includes close poll button visible only in presenter context via $renderContext in components/PollResults.vue
- [x] T032 [P] [US2] Create LivePoll.vue component — shown on the slide view (not presenter-only). Displays poll question text and a note that voting is active. Minimal — the actual voting happens on the audience page in components/LivePoll.vue
- [x] T033 [US2] Create AudiencePoll.vue component — mobile-friendly poll voting UI. Shows question and tappable option buttons. Highlights selected option. Calls submit-vote Edge Function via useSupabase. Shows "Poll closed" when poll.status=closed. Shows vote confirmation in pages/audience/components/AudiencePoll.vue
- [x] T034 [US2] Integrate poll display in audience App.vue — when slide-sync indicates current slide has a poll (poll data from session or sync-slide response), render AudiencePoll; otherwise show question feed
- [x] T035 [US2] Add poll slide to slides.md — slide references poll from lib/poll-config.ts (single source of truth for poll definitions). Slide content includes PollResults and LivePoll components. Presenter notes with bullet points for talking during poll
- [x] T036 [US2] Wire up Realtime subscription in PollResults.vue — subscribe to postgres_changes INSERT/UPDATE on poll_votes table filtered by active poll_id. On each change event, re-aggregate vote counts and update bar chart reactively

**Checkpoint**: Live polls work end-to-end. Presenter sees real-time results. Audience can vote and change their vote. Poll closes correctly.

---

## Phase 5: User Story 3 — Audience Submits and Upvotes Questions (Priority: P3)

**Goal**: Audience submits free-text questions from participation page. Questions appear in a shared feed sorted by net votes. Presenter sees top questions on Q&A slide and can mark them answered or hide them.

**Independent Test**: Submit a question from one device. Upvote it from another. Verify feed updates on all devices. Navigate to Q&A slide — top questions visible. Mark a question answered — visual change on all devices.

### Implementation

- [x] T037 [P] [US3] Implement submit-question Edge Function — validates session active, content passes validateQuestionContent() from lib/validation.ts (length 1-300, no spam/repeated chars). Applies rate limiting (3 questions/min/device). Inserts into questions table. Returns created question per contracts/edge-functions.md in supabase/functions/submit-question/index.ts
- [x] T038 [P] [US3] Implement vote-question Edge Function — validates session active, direction is 1 or -1. Toggle behavior: same direction = delete vote, opposite = update, new = insert. After vote change, recomputes question.score as SUM(direction) from question_votes. Applies rate limiting using shared "votes" limiter from T013 (30 votes/min/device, shared bucket with submit-vote). Per contracts/edge-functions.md in supabase/functions/vote-question/index.ts
- [x] T039 [P] [US3] Implement manage-question Edge Function — validates presenter token. Accepts actions: "answer", "unanswer", "hide", "unhide". Updates question.is_answered or question.is_hidden. Per contracts/edge-functions.md in supabase/functions/manage-question/index.ts
- [x] T040 [US3] Create QuestionFeed.vue component — renders question list sorted by score DESC. Each question shows content (plain text via textContent/v-text, never v-html), score, upvote/downvote buttons, answered badge. Subscribes to Realtime postgres_changes on questions and question_votes tables. Calls vote-question Edge Function on button tap in components/QuestionFeed.vue
- [x] T041 [US3] Create TopQuestions.vue component — presenter-only view for Q&A slide. Shows top questions sorted by net votes. Each question shows content, score, and action buttons (mark answered, hide). Calls manage-question Edge Function. Hidden questions shown with "hidden" badge. Uses useSupabase with service_role or fetches via Edge Function to see all questions including hidden in components/TopQuestions.vue
- [x] T042 [US3] Create AudienceQuestions.vue component — mobile-friendly question submission form (textarea with character counter, submit button) + scrollable question feed with upvote/downvote. Enforces 300 char limit client-side. Shows rate limit feedback. Calls submit-question and vote-question Edge Functions in pages/audience/components/AudienceQuestions.vue
- [x] T043 [US3] Integrate question feed in audience App.vue — AudienceQuestions is the default view when no poll is active on the current slide. Always accessible (persistent question submission regardless of current slide context)
- [x] T044 [US3] Add Q&A slide to slides.md — uses TopQuestions component. Slide positioned as final or second-to-last slide. Presenter notes with bullet points for Q&A facilitation
- [x] T045 [US3] Wire up Realtime subscriptions for questions — in QuestionFeed.vue and AudienceQuestions.vue, subscribe to postgres_changes on questions (INSERT for new, UPDATE for score/answered/hidden changes) filtered by session_id. Client-side filter excludes is_hidden=true for audience view
- [x] T046 [US3] Add presenter question controls — in TopQuestions.vue (Q&A slide) and optionally via RenderWhen context="presenter" on other slides, show moderation buttons: mark answered (toggles is_answered), hide question (sets is_hidden=true, removes from audience feed). Ensure all user-submitted content renders as plain text (v-text directive, never v-html)

**Checkpoint**: Q&A feed works end-to-end. Questions submitted, upvoted, sorted by score. Presenter can moderate. All user content renders as plain text.

---

## Phase 6: User Story 4 — Anti-Abuse Verification & Hardening (Priority: P2)

> **Ordering note**: US4 is P2 priority but placed after US3 (P3) because this phase verifies protections built into US2 and US3 Edge Functions. It must run after both are complete regardless of priority level.

**Goal**: Verify all anti-abuse protections from US4 acceptance scenarios are functioning correctly. The actual protections were built into foundational infrastructure (Phase 2) and integrated into each Edge Function (Phases 4-5). This phase confirms end-to-end enforcement.

**Independent Test**: Attempt rapid-fire question submissions (>3/min) — verify rejection. Submit >300 char question — verify rejection. Submit repeated characters — verify rejection. Vote 31+ times in a minute — verify throttling. Vote on same poll twice — verify replacement not duplicate.

### Verification Tasks

- [x] T047 [US4] Verify rate limiting enforcement — test submit-question rejects 4th question within 1 minute from same device_id with "Slow down" message (429 status). Test vote-question silently throttles after 30 votes/minute. Confirm Upstash rate limiter configuration matches spec (3 questions/60s, 30 votes/60s)
- [x] T048 [US4] Verify content validation — test submit-question rejects: content >300 chars ("Question too long"), empty/whitespace-only ("Question cannot be empty"), repeated characters like "aaaaaaa" or "!!!!!" ("Invalid question content"). Confirm validation runs server-side in Edge Function
- [x] T049 [US4] Verify poll vote deduplication — test submit-vote with same device_id + poll_id twice with different selected_option: second call replaces first (upsert), not creates duplicate. Confirm UNIQUE(poll_id, device_id) constraint in migration
- [x] T050 [US4] Verify question vote deduplication — test vote-question toggle behavior: same direction twice = vote removed, opposite direction = vote changed. Confirm question.score recomputed correctly after each change
- [x] T051 [US4] Verify plain text rendering — inspect all locations where user-submitted question content is displayed (QuestionFeed.vue, TopQuestions.vue, AudienceQuestions.vue). Confirm content uses v-text or textContent, never v-html. Test with content containing `<script>alert('xss')</script>` and `<img onerror=alert(1)>` — verify renders as literal text

**Checkpoint**: All US4 acceptance scenarios verified. Anti-abuse protections are active and correctly enforced.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Graceful degradation, visual polish, build validation.

- [x] T052 Verify graceful degradation — disconnect Supabase (stop local dev or use invalid URL). Confirm: slides navigate normally, presenter notes display, QR code renders. Interactive components show appropriate fallback messages ("Poll unavailable", "Connection lost"). No unhandled errors, blank screens, or layout shifts
- [x] T053 [P] Style audience participation page mobile-first — ensure usability on 320px+ screens. Apply Regent brand colors (#272833 background, #0099CC primary, #DADCF1 text), Century Gothic typography. Test touch targets (minimum 44px), readable font sizes, appropriate spacing
- [x] T054 [P] Style interactive slide components — PollResults bar chart, QuestionFeed, TopQuestions, LivePoll, ConnectionStatus. Ensure Regent brand consistency (#0099CC, #3FCDFA, #E0E0E0). Verify components don't overlap header (40px) or footer (30px) chrome
- [x] T055 Verify Vite build output — run `npm run build`, serve dist/ locally, confirm: slides work, audience page loads at /audience/ within 5 seconds on throttled 3G (per Constitution presentation constraint), QR code points to correct URL, Supabase connection attempts work (or degrade gracefully if no backend). Check bundle size of audience page entry point (target <200 KB gzipped for 5s budget)
- [x] T056 Run quickstart.md validation — follow all steps from quickstart.md end-to-end: install deps, start Supabase locally, configure env, serve functions, open presenter + audience pages, test poll voting, question submission, and presenter controls. Verify success criteria timing: SC-001 slide-sync reflects on audience within 2 seconds, SC-002 poll votes update presenter chart within 2 seconds, SC-003 question feed updates within 2 seconds. Smoke-test concurrent connections: open 5+ audience tabs simultaneously and confirm Realtime subscriptions remain stable (SC-004 targets 200 concurrent but manual smoke test validates the pattern works)
- [x] T057 Verify WCAG 2.1 AA compliance on audience page — check all interactive components (AudiencePoll, AudienceQuestions) for: keyboard navigability (Tab/Enter/Space), focus indicators visible against #272833 background, ARIA labels on vote buttons and form fields, color contrast ratios (minimum 4.5:1 for text, 3:1 for large text/UI components), touch targets minimum 44x44px, screen reader announcements for live vote count updates (aria-live region). Fix any violations found. Per Constitution VI (WCAG 2.1 AA)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational. Delivers the MVP (QR code + slide sync + audience page shell)
- **US2 (Phase 4)**: Depends on Foundational. Also depends on US1 for audience page routing (poll display integrated into App.vue)
- **US3 (Phase 5)**: Depends on Foundational. Also depends on US1 for audience page routing (question feed integrated into App.vue)
- **US4 (Phase 6)**: Depends on US2 and US3 completion (verifies protections built into those phases)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P2)**: Can start after Foundational — integrates with US1's audience App.vue (T034 depends on T025)
- **US3 (P3)**: Can start after Foundational — integrates with US1's audience App.vue (T043 depends on T025)
- **US4 (P2)**: Verification phase — depends on US2 and US3 being complete
- **US2 and US3**: Can proceed in parallel after US1's audience page shell (T025) is complete

### Within Each User Story

- Edge Functions marked [P] can be built in parallel (different files)
- Presenter-side components can be built in parallel with audience-side components
- Realtime wiring tasks depend on both the component and the Edge Function being ready
- Integration tasks (App.vue updates) depend on the component being complete

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003, T004, T005)
- All Foundational shared utilities (T008, T009, T010) can run in parallel
- All Edge Function shared helpers (T011, T012, T013) can run in parallel
- Core composables T015, T016 can run in parallel (T014 is independent)
- US1: T019 (QrCode) and T026 (StatusMessage) can run in parallel
- US2: T029 (submit-vote) and T030 (manage-poll) can run in parallel; T031 and T032 can run in parallel
- US3: T037 (submit-question), T038 (vote-question), T039 (manage-question) can all run in parallel
- Polish: T053 and T054 can run in parallel

---

## Parallel Example: Phase 2 Foundational

```bash
# Launch all shared utilities together:
Task: "Create TypeScript interfaces in lib/types.ts"
Task: "Create shared constants in lib/constants.ts"
Task: "Create content validation in lib/validation.ts"

# Launch all Edge Function helpers together:
Task: "Create CORS helper in supabase/functions/_shared/cors.ts"
Task: "Create admin client factory in supabase/functions/_shared/supabase.ts"
Task: "Create rate limiter factory in supabase/functions/_shared/ratelimit.ts"

# Launch independent composables together:
Task: "Create useDeviceId in composables/useDeviceId.ts"
Task: "Create usePresenterAuth in composables/usePresenterAuth.ts"
```

## Parallel Example: User Story 3 Edge Functions

```bash
# Launch all US3 Edge Functions together (different files, no dependencies):
Task: "Implement submit-question in supabase/functions/submit-question/index.ts"
Task: "Implement vote-question in supabase/functions/vote-question/index.ts"
Task: "Implement manage-question in supabase/functions/manage-question/index.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (QR code + slide sync + audience page)
4. **STOP and VALIDATE**: Scan QR code, verify page loads, verify slide sync works
5. Demo if ready — audience can connect and see slide context changes

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → Demo (MVP!)
3. Add US2 → Test poll voting → Demo (interactive polls!)
4. Add US3 → Test Q&A feed → Demo (full interaction suite)
5. Run US4 verification → Confirm anti-abuse protections
6. Polish → Final visual and build validation
7. Each story adds value without breaking previous stories

### Sequential Execution (Single Developer)

1. Phase 1: Setup (T001-T005)
2. Phase 2: Foundational (T006-T018)
3. Phase 3: US1 MVP (T019-T028)
4. Phase 4: US2 Polls (T029-T036)
5. Phase 5: US3 Q&A (T037-T046)
6. Phase 6: US4 Verification (T047-T051)
7. Phase 7: Polish (T052-T057)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US4 (Anti-Abuse) protections are BUILT INTO Edge Functions during US2/US3 development; Phase 6 VERIFIES they work end-to-end
- All user-submitted content MUST use v-text directive, never v-html (XSS prevention per FR-014)
- Supabase imports MUST be lazy/conditional to preserve offline slide deck functionality (Constitution IV)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
