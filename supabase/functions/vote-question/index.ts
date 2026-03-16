import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'

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
  const { question_id, device_id, direction } = body

  if (!question_id || !device_id || ![1, -1].includes(direction)) {
    return new Response(JSON.stringify({ error: 'Invalid direction' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createAdminClient()

  // Verify question exists and session is active
  const { data: question } = await supabase
    .from('questions')
    .select('id, session_id')
    .eq('id', question_id)
    .single()

  if (!question) {
    return new Response(JSON.stringify({ error: 'Question not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', question.session_id)
    .single()

  if (session?.status === 'ended') {
    return new Response(JSON.stringify({ error: 'Session has ended' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check existing vote (one vote per device per question — enforced by DB unique constraint)
  const { data: existingVote } = await supabase
    .from('question_votes')
    .select('id, direction')
    .eq('question_id', question_id)
    .eq('device_id', device_id)
    .single()

  let action: 'created' | 'changed' | 'removed'

  if (existingVote) {
    if (existingVote.direction === direction) {
      // Same direction → toggle off (remove)
      await supabase.from('question_votes').delete().eq('id', existingVote.id)
      action = 'removed'
    } else {
      // Opposite direction → update
      await supabase
        .from('question_votes')
        .update({ direction })
        .eq('id', existingVote.id)
      action = 'changed'
    }
  } else {
    // New vote
    await supabase
      .from('question_votes')
      .insert({ question_id, device_id, direction })
    action = 'created'
  }

  // Recompute score
  const { data: votes } = await supabase
    .from('question_votes')
    .select('direction')
    .eq('question_id', question_id)

  const score = (votes || []).reduce((sum: number, v: any) => sum + v.direction, 0)

  await supabase
    .from('questions')
    .update({ score })
    .eq('id', question_id)

  return new Response(JSON.stringify({
    vote: { question_id, direction, action },
    question: { id: question_id, score },
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
