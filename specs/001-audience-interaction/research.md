# Research: Audience Interaction

**Feature**: 001-audience-interaction
**Date**: 2026-02-27
**Status**: Complete

## Research Topics

### 1. Supabase Realtime & Edge Functions

**Decision**: Use Supabase Realtime with two complementary channels: **Broadcast** for ephemeral slide-sync notifications and **Postgres Changes** for persistent data subscriptions (poll votes, questions, question votes).

**Rationale**:
- Broadcast is low-latency pub/sub that does not touch the database — ideal for slide-change events where persistence is unnecessary and latency must be minimal.
- Postgres Changes delivers row-level change events (INSERT, UPDATE, DELETE) to subscribed clients, enabling live poll results and question feed updates.
- Both can coexist on a single channel connection, minimizing WebSocket overhead.

**Alternatives considered**:
- Postgres Changes only (for slide-sync): Rejected because writing a "current_slide" row to the DB on every slide change adds unnecessary latency and storage writes for ephemeral data.
- External WebSocket server: Rejected because Supabase Realtime already provides managed WebSocket infrastructure with the project.

### 2. Edge Functions for Server-Side Writes

**Decision**: All write operations go through Supabase Edge Functions (Deno runtime) using the `service_role` key. The browser uses the `anon` key for read-only Realtime subscriptions.

**Rationale**:
- The `service_role` key bypasses RLS entirely, allowing Edge Functions to perform validated writes server-side.
- The `anon` key in the browser can only SELECT (enforced by RLS policies), so even if someone crafts a direct PostgREST request, all write attempts are denied.
- Edge Functions provide a natural place for input validation, rate limiting, and content filtering before data reaches the database.
- Environment variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are auto-available in every Edge Function.

**Alternatives considered**:
- Direct PostgREST with RLS INSERT policies: Rejected because the spec explicitly requires "no SQL queries directly from the browser" and server-side validation/rate-limiting is harder to enforce with RLS alone.
- External API server (Node.js/Express): Rejected — unnecessary infrastructure when Edge Functions are already part of the Supabase stack.

### 3. Row Level Security (RLS) Strategy

**Decision**: Enable RLS on all tables. Create SELECT-only policies for the `anon` role. No INSERT/UPDATE/DELETE policies for `anon`. All writes go through Edge Functions using `service_role`.

**Rationale**:
- Realtime `postgres_changes` requires at least a SELECT policy for the subscribing role; without it, the table is silently excluded from change delivery.
- Zero write policies for `anon` means even a malicious client with the `anon` key cannot modify data.
- The `service_role` has the Postgres `BYPASSRLS` attribute, skipping all policies entirely.

### 4. Anonymous Device Identification

**Decision**: UUID stored in `localStorage` via `crypto.randomUUID()`.

**Rationale**:
- Guaranteed unique (UUIDv4 = 2^122 bits of entropy), persists across page refreshes during the session.
- Minimal privacy footprint — no device characteristics collected.
- No GDPR concerns about fingerprinting.
- If a user clears storage, the worst case is a new device ID (rate limits and vote deduplication reset for that device). Acceptable trade-off for a single-session presentation.

**Alternatives considered**:
- Browser fingerprinting (FingerprintJS): Rejected — legally questionable under GDPR for non-fraud use, collision-prone on mobile, unnecessary complexity for a single-event system.
- Session cookies: Rejected — `localStorage` is simpler and doesn't require cookie consent banners.

### 5. Rate Limiting

**Decision**: Use Upstash Redis with `@upstash/ratelimit` sliding window in Edge Functions.

**Rationale**:
- Upstash provides an HTTP/REST-based Redis client designed for serverless/edge environments (no persistent TCP connection needed).
- Sliding window algorithm provides smooth rate limiting (3 questions/min, 30 votes/min per device).
- Rate limit state survives Edge Function cold starts (unlike in-memory approaches).
- Supabase officially recommends and documents this pattern.

**Alternatives considered**:
- In-memory rate limiting in Edge Functions: Rejected — resets on cold starts, making limits unreliable during a live presentation.
- PostgreSQL-based rate tracking: Rejected — adds write overhead to every rate-check operation, defeating the purpose of Edge Functions as a validation layer.

### 6. Slidev Custom Components

**Decision**: Place Vue components in `components/` directory at project root. Use Slidev composables (`useNav`, `useSlideContext`, `onSlideEnter`, `onSlideLeave`) for slide state access.

**Rationale**:
- Slidev auto-discovers and registers any `.vue` file in `components/` via `unplugin-vue-components`. No manual imports needed.
- Components can access `$nav.currentPage`, `$renderContext`, and other injected globals in templates.
- `<script setup>` code uses `useNav()` and `useSlideContext()` composables for reactive slide state.
- `RenderWhen` built-in component enables presenter-only UI (e.g., question moderation panel).

**Key findings**:
- Static build (`slidev build`) produces a full Vue 3 SPA — all reactivity, `fetch`, WebSocket, and npm packages work in the built output.
- `onSlideEnter` / `onSlideLeave` lifecycle hooks enable connecting/disconnecting Supabase channels per slide.
- `$renderContext` values: `'slide'`, `'presenter'`, `'overview'`, `'previewNext'`.
- `setup/main.ts` with `defineAppSetup` for Vue plugin registration if needed.

### 7. QR Code Generation

**Decision**: Use `qrcode-svg` package with a reusable `QrCode.vue` component using `v-html` for SVG output.

**Rationale**:
- Zero dependencies, ~8-10 kB gzipped, pure JavaScript, SVG-only output.
- SVG scales perfectly at any display resolution, projector resolution, or PDF export zoom level.
- Synchronous API (`new QRCode(...).svg()`) — no async/loading states needed.
- SVG colors can be styled to match the Regent brand (`#DADCF1` on transparent/`#272833`).
- `container: 'svg-viewbox'` uses `viewBox` for responsive scaling.
- `join: true` merges all modules into a single `<path>` element for a cleaner, smaller SVG.

**Alternatives considered**:
- `qrcode` (node-qrcode): Rejected — ~33 kB gzipped, includes unnecessary Canvas/PNG support and multiple dependencies.
- `qrcode.vue`: Rejected — thin wrapper around `qrcode`, inherits its full bundle size for no benefit over `v-html`.
- Pre-generated static SVG file: Viable but less flexible — the QR code URL may change between dev/staging/prod. A component approach handles this naturally via props.

### 8. Connection Limits & Scaling

**Decision**: Free tier (200 concurrent connections) is sufficient for initial development and testing. Pro tier ($25/mo, 500 connections included) for production if audience exceeds ~180.

**Key limits**:

| Resource | Free | Pro ($25/mo) |
|---|---|---|
| Realtime Peak Connections | 200 (hard limit) | 500 included, $10/1000 overage |
| Realtime Messages | 2M/mo (hard limit) | 5M/mo, $2.50/M overage |
| Edge Function Invocations | 500K/mo | 2M/mo |
| Channels per Connection | ~100 | ~100 |

**Implication**: A 200-person conference room fits comfortably within the free tier. The Pro tier at $25/mo handles up to 1,500 concurrent connections for $10 additional overage.

### 9. Audience Participation Page Architecture

**Decision**: Build as a separate Vite entry point (`pages/audience/index.html`) served alongside the Slidev presentation. Not embedded in Slidev slides.

**Rationale**:
- The audience page is a standalone mobile-first web app with its own routing (no slide navigation).
- Vite multi-page app support allows additional entry points without affecting the Slidev build.
- The audience page and the Slidev presentation share the same Supabase client configuration and TypeScript types.
- Keeps the Slidev slide deck clean — interactive components on slides (poll results chart, top questions) are separate from the audience submission UI.

**Alternatives considered**:
- Separate repository/project: Rejected — shared types and Supabase config would need to be duplicated or published as a package. Unnecessary for a single-event presentation.
- Embedded in Slidev as a custom layout/route: Rejected — Slidev's routing is slide-based, not suitable for a multi-view mobile app with persistent question feed and contextual poll UI.
