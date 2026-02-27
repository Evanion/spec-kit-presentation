import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
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

  // Verify presenter token
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid presenter token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const token = auth.slice(7)
  const tokenHash = await hashToken(token)
  const supabase = createAdminClient()

  // Find active session for this presenter
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

  const body = await req.json()
  const slideNumber = body.slide_number

  if (typeof slideNumber !== 'number' || slideNumber < 1) {
    return new Response(JSON.stringify({ error: 'Invalid slide number' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Update session current_slide
  await supabase
    .from('sessions')
    .update({ current_slide: slideNumber })
    .eq('id', session.id)

  // Send Broadcast event for slide-sync
  const channel = supabase.channel('presentation-live')
  await channel.send({
    type: 'broadcast',
    event: 'slide-change',
    payload: { slide: slideNumber, timestamp: Date.now() },
  })
  supabase.removeChannel(channel)

  // Check if target slide has a poll
  const { data: poll } = await supabase
    .from('polls')
    .select('id, question, options, status')
    .eq('session_id', session.id)
    .eq('slide_number', slideNumber)
    .single()

  return new Response(JSON.stringify({
    slide_number: slideNumber,
    poll: poll || null,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
