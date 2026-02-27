# Implementation Plan: Audience Interaction

**Branch**: `001-audience-interaction` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-audience-interaction/spec.md`

## Summary

Add real-time audience interaction to the Slidev presentation: QR code entry, live polls with vote-changing, persistent Q&A with upvote/downvote, and presenter controls (mark answered, hide, reset). All writes go through Supabase Edge Functions with Upstash rate limiting; the browser connects read-only via Realtime subscriptions. Slide-sync uses Realtime Broadcast (no DB). The presentation remains fully functional when the backend is unavailable (progressive enhancement).

## Technical Context

**Language/Version**: TypeScript 5.x (Slidev/Vue components), Deno (Edge Functions)
**Primary Dependencies**: Slidev v51+, Vue 3, @supabase/supabase-js v2, qrcode-svg, @upstash/ratelimit, UnoCSS
**Storage**: Supabase PostgreSQL (managed) with Row Level Security
**Testing**: Manual integration testing (presenter + audience devices), Supabase local dev (`supabase start`)
**Target Platform**: Modern browsers (Chrome/Firefox/Safari/Edge latest), mobile Safari 16+, Chrome for Android 110+
**Project Type**: Slidev presentation with integrated serverless backend (Edge Functions) and mobile participation page
**Performance Goals**: <2s perceived latency for slide-sync and vote updates, <5s audience page load on 4G
**Constraints**: Free tier 200 concurrent Realtime connections (upgrade to Pro for >180 audience), offline-capable slide deck
**Scale/Scope**: Single concurrent session, up to 200 audience devices, 1 presenter

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Content Clarity
- **Status**: PASS
- Interactive components on slides (poll chart, QR code, top questions) communicate a single idea per slide. Presenter notes remain scannable bullet points.

### II. Brand Consistency
- **Status**: PASS
- QR code component uses Regent color palette (`#DADCF1` on transparent). Poll result charts styled with brand colors (`#0099CC`, `#3FCDFA`). Audience participation page uses the same color scheme and Century Gothic typography.

### III. Audience Engagement
- **Status**: PASS (directly addressed)
- This feature IS the audience engagement implementation. Opt-in participation (no login), real-time poll results (<2s), question upvoting for presenter prioritization.

### IV. Live Reliability (NON-NEGOTIABLE)
- **Status**: PASS
- Slide content, navigation, and presenter notes have zero dependency on Supabase. Interactive Vue components detect backend unavailability and show graceful degradation messages ("Poll unavailable — check back shortly"). All Supabase imports are lazy/conditional. The static build serves the complete deck without any server-side runtime.

### V. Progressive Enhancement
- **Status**: PASS
- Static build on GitHub Pages serves the complete slide deck. Interactive features layer on top via Vue components that connect to Supabase only when available. `qrcode-svg` is the only new non-Supabase dependency (zero transitive deps, ~8-10 kB gzipped). Each dependency is justified by a concrete presentation need.

### Post-Phase 1 Re-check
- All five principles remain satisfied. No violations detected.

## Project Structure

### Documentation (this feature)

```text
specs/001-audience-interaction/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── edge-functions.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
(root)
├── slides.md                    # Slidev presentation (add poll/QR/Q&A slides)
├── components/                  # Slidev auto-imported Vue components
│   ├── QrCode.vue               # QR code display (qrcode-svg)
│   ├── LivePoll.vue             # Poll voting UI (audience view on slide)
│   ├── PollResults.vue          # Live bar chart (presenter slide)
│   ├── QuestionFeed.vue         # Q&A feed with upvote/downvote
│   ├── TopQuestions.vue         # Top questions for Q&A slide (presenter)
│   └── ConnectionStatus.vue     # "Reconnecting..." indicator
├── composables/                 # Shared Vue composables
│   ├── useSupabase.ts           # Supabase client singleton + connection state
│   ├── useSession.ts            # Session lifecycle (create, end, reset)
│   ├── useSlideSync.ts          # Broadcast slide-change events
│   ├── useDeviceId.ts           # Anonymous device UUID from localStorage
│   └── usePresenterAuth.ts     # Token extraction from URL + localStorage
├── pages/                       # Audience participation page (separate Vite entry)
│   └── audience/
│       ├── index.html           # Entry point (QR code target URL)
│       ├── main.ts              # Vue app bootstrap
│       ├── App.vue              # Root component with slide-sync listener
│       └── components/
│           ├── AudiencePoll.vue     # Poll voting interface (mobile)
│           ├── AudienceQuestions.vue # Question feed + submission (mobile)
│           └── StatusMessage.vue    # Connection/session status messages
├── lib/                         # Shared utilities
│   ├── types.ts                 # TypeScript interfaces (Session, Poll, Question, etc.)
│   ├── validation.ts            # Content validation (length, spam detection)
│   └── constants.ts             # Rate limits, max lengths, Supabase URL
├── supabase/
│   ├── config.toml              # Project config, JWT verification settings
│   ├── migrations/
│   │   └── 001_initial_schema.sql  # Tables, RLS policies, indexes
│   └── functions/
│       ├── _shared/
│       │   ├── cors.ts          # CORS headers helper
│       │   ├── supabase.ts      # Admin client factory
│       │   └── ratelimit.ts     # Upstash rate limiter factory
│       ├── session/index.ts     # Create, end, reset session (presenter-only)
│       ├── sync-slide/index.ts  # Broadcast slide change + update DB (presenter-only)
│       ├── submit-vote/index.ts # Cast/change poll vote (audience)
│       ├── submit-question/index.ts  # Submit a question (audience)
│       ├── vote-question/index.ts    # Upvote/downvote a question (audience)
│       ├── manage-poll/index.ts      # Open/close poll (presenter-only)
│       └── manage-question/index.ts  # Mark answered, hide (presenter-only)
├── vite.config.ts               # Multi-page entry points (slides + audience)
└── package.json                 # Slidev + supabase-js + qrcode-svg + upstash deps
```

**Structure Decision**: Single project at repository root. Slidev presentation files coexist with the `supabase/` directory (standard Supabase CLI layout) and a `pages/audience/` directory for the mobile participation page (Vite multi-page entry). No workspace or monorepo needed — shared types in `lib/` are imported directly by both the Slidev components and the audience page.

## Complexity Tracking

> No constitution violations detected. Table intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
