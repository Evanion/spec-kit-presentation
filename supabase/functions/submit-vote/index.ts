import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { votesLimiter } from '../_shared/ratelimit.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json()
  const { poll_id, device_id, selected_option } = body

  if (!poll_id || !device_id || typeof selected_option !== 'number') {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Rate limiting (shared "votes" bucket with vote-question)
  const { success, limit, remaining, reset } = await votesLimiter.limit(device_id)
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(reset),
  }

  if (!success) {
    return new Response(JSON.stringify({ error: 'Slow down — try again in a moment' }), {
      status: 429,
      headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createAdminClient()

  // Validate poll exists and is open
  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .select('id, options, status, session_id')
    .eq('id', poll_id)
    .single()

  if (pollError || !poll) {
    return new Response(JSON.stringify({ error: 'Poll not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check session is active
  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', poll.session_id)
    .single()

  if (session?.status === 'ended') {
    return new Response(JSON.stringify({ error: 'Session has ended' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (poll.status === 'closed') {
    return new Response(JSON.stringify({ error: 'Poll is closed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Validate option index
  const options = poll.options as string[]
  if (selected_option < 0 || selected_option >= options.length) {
    return new Response(JSON.stringify({ error: 'Invalid option index' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Upsert vote (one vote per device per poll)
  const { data: existingVote } = await supabase
    .from('poll_votes')
    .select('id, selected_option')
    .eq('poll_id', poll_id)
    .eq('device_id', device_id)
    .single()

  const changed = existingVote !== null

  const { error: voteError } = await supabase
    .from('poll_votes')
    .upsert(
      {
        poll_id,
        device_id,
        selected_option,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'poll_id,device_id' },
    )

  if (voteError) {
    return new Response(JSON.stringify({ error: 'Failed to submit vote' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({
    vote: {
      poll_id,
      selected_option,
      changed,
    },
  }), {
    status: 200,
    headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
  })
})
