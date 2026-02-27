import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function verifyPresenter(req: Request, supabase: any): Promise<{ tokenHash: string } | Response> {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid presenter token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const token = auth.slice(7)
  const tokenHash = await hashToken(token)
  return { tokenHash }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createAdminClient()
  const url = new URL(req.url)
  const path = url.pathname.split('/').pop()

  const authResult = await verifyPresenter(req, supabase)
  if (authResult instanceof Response) return authResult
  const { tokenHash } = authResult

  // Route based on path suffix
  if (path === 'end') {
    return handleEnd(supabase, tokenHash)
  }
  if (path === 'reset') {
    return handleReset(supabase, tokenHash)
  }
  // Default: create/retrieve session
  return handleCreate(req, supabase, tokenHash)
})

async function handleCreate(req: Request, supabase: any, tokenHash: string): Promise<Response> {
  // Check for existing active session
  const { data: existing } = await supabase
    .from('sessions')
    .select('*')
    .eq('presenter_token_hash', tokenHash)
    .eq('status', 'active')
    .single()

  if (existing) {
    // Return existing session + polls
    const { data: polls } = await supabase
      .from('polls')
      .select('id, slide_number, question, options, status')
      .eq('session_id', existing.id)
      .order('slide_number')

    return new Response(JSON.stringify({
      session: {
        id: existing.id,
        status: existing.status,
        current_slide: existing.current_slide,
        created_at: existing.created_at,
      },
      polls: polls || [],
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Create new session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({ presenter_token_hash: tokenHash })
    .select()
    .single()

  if (sessionError) {
    return new Response(JSON.stringify({ error: 'Failed to create session' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Seed polls from request body
  let polls: any[] = []
  try {
    const body = await req.json()
    if (body.polls && Array.isArray(body.polls)) {
      const pollRows = body.polls.map((p: any) => ({
        session_id: session.id,
        slide_number: p.slide_number,
        question: p.question,
        options: p.options,
      }))

      const { data: insertedPolls } = await supabase
        .from('polls')
        .insert(pollRows)
        .select('id, slide_number, question, options, status')

      polls = insertedPolls || []
    }
  } catch {
    // No body or invalid JSON — session created without polls
  }

  return new Response(JSON.stringify({
    session: {
      id: session.id,
      status: session.status,
      current_slide: session.current_slide,
      created_at: session.created_at,
    },
    polls,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function handleEnd(supabase: any, tokenHash: string): Promise<Response> {
  const { data: session, error } = await supabase
    .from('sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('presenter_token_hash', tokenHash)
    .eq('status', 'active')
    .select()
    .single()

  if (error || !session) {
    return new Response(JSON.stringify({ error: 'No active session found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({
    session: {
      id: session.id,
      status: session.status,
      ended_at: session.ended_at,
    },
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function handleReset(supabase: any, tokenHash: string): Promise<Response> {
  // Find active session
  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('presenter_token_hash', tokenHash)
    .eq('status', 'active')
    .single()

  if (!session) {
    return new Response(JSON.stringify({ error: 'No active session found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get poll IDs for this session
  const { data: polls } = await supabase
    .from('polls')
    .select('id')
    .eq('session_id', session.id)

  const pollIds = (polls || []).map((p: any) => p.id)

  // Clear poll votes
  let pollVotesCleared = 0
  if (pollIds.length > 0) {
    const { count } = await supabase
      .from('poll_votes')
      .delete({ count: 'exact' })
      .in('poll_id', pollIds)
    pollVotesCleared = count || 0
  }

  // Get question IDs then clear question votes
  const { data: questions } = await supabase
    .from('questions')
    .select('id')
    .eq('session_id', session.id)

  const questionIds = (questions || []).map((q: any) => q.id)
  let questionVotesCleared = 0
  if (questionIds.length > 0) {
    const { count } = await supabase
      .from('question_votes')
      .delete({ count: 'exact' })
      .in('question_id', questionIds)
    questionVotesCleared = count || 0
  }

  // Clear questions
  const { count: questionsCleared } = await supabase
    .from('questions')
    .delete({ count: 'exact' })
    .eq('session_id', session.id)

  // Re-open all polls and reset current_slide
  await supabase
    .from('polls')
    .update({ status: 'open' })
    .eq('session_id', session.id)

  await supabase
    .from('sessions')
    .update({ current_slide: 1 })
    .eq('id', session.id)

  return new Response(JSON.stringify({
    session: {
      id: session.id,
      status: 'active',
      current_slide: 1,
    },
    cleared: {
      poll_votes: pollVotesCleared,
      questions: questionsCleared || 0,
      question_votes: questionVotesCleared,
    },
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
