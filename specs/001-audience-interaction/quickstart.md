# Quickstart: Audience Interaction

**Feature**: 001-audience-interaction
**Prerequisites**: Node.js 18+, Supabase CLI, Supabase project (free tier sufficient)

## 1. Install Dependencies

```bash
npm install @supabase/supabase-js qrcode-svg
```

## 2. Set Up Supabase Locally

```bash
# Initialize Supabase (if not already done)
npx supabase init

# Start local Supabase (Docker required)
npx supabase start

# Apply the database migration
npx supabase db push
```

The migration file at `supabase/migrations/001_initial_schema.sql` creates all tables, RLS policies, and indexes.

## 3. Configure Environment

Create `.env.local` at the project root:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<from supabase start output>
VITE_PRESENTER_TOKEN=my-secret-presenter-token
VITE_AUDIENCE_URL=http://localhost:3030/audience/
```

For production, set these values to your hosted Supabase project credentials and the deployed audience page URL.

## 4. Set Up Edge Function Secrets

```bash
# For Upstash rate limiting (create a free Upstash Redis at upstash.com)
npx supabase secrets set UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
npx supabase secrets set UPSTASH_REDIS_REST_TOKEN="your-token"
```

## 5. Run the Presentation

```bash
# Terminal 1: Slidev dev server (presentation + audience page)
npm run dev

# Terminal 2: Supabase Edge Functions
npx supabase functions serve --env-file .env.local
```

## 6. Access Points

| Interface | URL | Purpose |
|-----------|-----|---------|
| Presenter slides | `http://localhost:3030?token=my-secret-presenter-token` | Normal slide deck with live poll results |
| Presenter view | `http://localhost:3030/presenter?token=my-secret-presenter-token` | Slidev presenter mode with question controls |
| Audience page | `http://localhost:3030/audience/` | Mobile participation (QR code target) |

## 7. Verify It Works

1. Open the presenter slides URL in a browser tab.
2. Open the audience page URL on a phone (or another browser tab).
3. Navigate to the poll slide — the poll should appear on the audience page.
4. Vote from the audience page — results should update live on the presenter slide.
5. Submit a question from the audience page — it should appear in the question feed.
6. Navigate to the Q&A slide — top questions should be visible.

## 8. Deploy

```bash
# Build the static presentation + audience page
npm run build

# Deploy Edge Functions to production
npx supabase functions deploy

# The static build (dist/) deploys to GitHub Pages via existing CI workflow
```

## Common Issues

- **"Poll unavailable" on slide**: Supabase local dev not running. Start with `npx supabase start`.
- **No real-time updates**: Check that RLS is enabled and SELECT policies exist on all tables.
- **CORS errors**: Edge Functions must return CORS headers. Check `_shared/cors.ts`.
- **Rate limit errors during testing**: Reset Upstash counters or increase limits in `.env.local`.
- **Rotating the presenter token**: Change `VITE_PRESENTER_TOKEN` in `.env.local`, restart the dev server, and use the new token in the URL. The old session remains in the database but becomes inaccessible (token hash won't match). For production, update the environment variable in your hosting provider and redeploy.
