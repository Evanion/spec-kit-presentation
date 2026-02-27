import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { questionsLimiter } from '../_shared/ratelimit.ts'

function validateQuestionContent(text: string): { valid: boolean; error: string | null } {
  const trimmed = text.trim()

  if (trimmed.length === 0) {
    return { valid: false, error: 'Question cannot be empty' }
  }

  if (trimmed.length > 300) {
    return { valid: false, error: 'Question too long' }
  }

  if (/^(.)\1{4,}$/.test(trimmed)) {
    return { valid: false, error: 'Invalid question content' }
  }

  if (/^(.{1,3})\1{4,}$/.test(trimmed)) {
    return { valid: false, error: 'Invalid question content' }
  }

  const meaningful = trimmed.replace(/[\s\p{P}\p{S}]/gu, '')
  if (meaningful.length === 0) {
    return { valid: false, error: 'Invalid question content' }
  }

  return { valid: true, error: null }
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

  const body = await req.json()
  const { session_id, device_id, content } = body

  if (!session_id || !device_id || !content) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Rate limiting
  const { success, limit, remaining, reset } = await questionsLimiter.limit(device_id)
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

  // Validate content
  const validation = validateQuestionContent(content)
  if (!validation.valid) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createAdminClient()

  // Check session is active
  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', session_id)
    .single()

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (session.status === 'ended') {
    return new Response(JSON.stringify({ error: 'Session has ended' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Insert question
  const { data: question, error } = await supabase
    .from('questions')
    .insert({
      session_id,
      device_id,
      content: content.trim(),
    })
    .select('id, content, score, created_at')
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to submit question' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ question }), {
    status: 201,
    headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
  })
})
