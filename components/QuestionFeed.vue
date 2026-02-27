<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { useDeviceId } from '../composables/useDeviceId'
import { FUNCTIONS_BASE } from '../lib/constants'
import type { Question } from '../lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

const props = defineProps<{
  sessionId: string
}>()

const { supabase, isAvailable } = useSupabase()
const deviceId = useDeviceId()

const questions = ref<Question[]>([])
const myVotes = ref<Record<string, number>>({})

let channel: RealtimeChannel | null = null

async function fetchQuestions() {
  if (!supabase) return

  const { data } = await supabase
    .from('questions')
    .select('*')
    .eq('session_id', props.sessionId)
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })

  if (data) {
    questions.value = data
  }

  // Fetch my votes
  const { data: votes } = await supabase
    .from('question_votes')
    .select('question_id, direction')
    .eq('device_id', deviceId)

  if (votes) {
    const map: Record<string, number> = {}
    votes.forEach((v: any) => { map[v.question_id] = v.direction })
    myVotes.value = map
  }
}

function subscribeToChanges() {
  if (!supabase) return

  channel = supabase
    .channel(`questions-${props.sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'questions', filter: `session_id=eq.${props.sessionId}` },
      () => fetchQuestions(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'question_votes' },
      () => fetchQuestions(),
    )
    .subscribe()
}

async function voteQuestion(questionId: string, direction: 1 | -1) {
  try {
    const response = await fetch(`${FUNCTIONS_BASE}/vote-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, device_id: deviceId, direction }),
    })

    if (response.ok) {
      const data = await response.json()
      if (data.vote.action === 'removed') {
        delete myVotes.value[questionId]
      } else {
        myVotes.value[questionId] = direction
      }
      // Update local score
      const q = questions.value.find((q) => q.id === questionId)
      if (q) q.score = data.question.score
    }
  } catch {
    // Fail silently
  }
}

onMounted(() => {
  fetchQuestions()
  subscribeToChanges()
})

onUnmounted(() => {
  if (channel && supabase) {
    supabase.removeChannel(channel)
  }
})
</script>

<template>
  <div class="question-feed" v-if="isAvailable">
    <div v-if="questions.length === 0" class="no-questions">
      No questions yet — be the first to ask!
    </div>

    <div v-for="q in questions" :key="q.id" class="question-item" :class="{ answered: q.is_answered }">
      <div class="question-votes">
        <button
          class="vote-btn up"
          :class="{ active: myVotes[q.id] === 1 }"
          :aria-label="`Upvote question: ${q.content}`"
          @click="voteQuestion(q.id, 1)"
        >&#9650;</button>
        <span class="vote-score" aria-live="polite">{{ q.score }}</span>
        <button
          class="vote-btn down"
          :class="{ active: myVotes[q.id] === -1 }"
          :aria-label="`Downvote question: ${q.content}`"
          @click="voteQuestion(q.id, -1)"
        >&#9660;</button>
      </div>
      <div class="question-content">
        <p class="question-text" v-text="q.content" />
        <span v-if="q.is_answered" class="answered-badge">Answered</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.question-feed {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.no-questions {
  text-align: center;
  color: #DADCF1;
  opacity: 0.5;
  padding: 24px;
}

.question-item {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  background: #3C3C46;
  border-radius: 6px;
  align-items: flex-start;
}

.question-item.answered {
  opacity: 0.6;
}

.question-votes {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 36px;
}

.vote-btn {
  background: none;
  border: none;
  color: #DADCF1;
  font-size: 0.7rem;
  cursor: pointer;
  padding: 4px;
  min-width: 44px;
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.vote-btn:hover {
  background: #4D4E5C;
}

.vote-btn:focus-visible {
  outline: 2px solid #3FCDFA;
  outline-offset: 1px;
}

.vote-btn.active.up {
  color: #0099CC;
}

.vote-btn.active.down {
  color: #ff5722;
}

.vote-score {
  font-size: 0.85rem;
  font-weight: 700;
  color: #DADCF1;
}

.question-content {
  flex: 1;
  min-width: 0;
}

.question-text {
  color: #DADCF1;
  font-size: 0.9rem;
  margin: 0;
  word-break: break-word;
}

.answered-badge {
  display: inline-block;
  margin-top: 4px;
  font-size: 0.65rem;
  background: #0099CC33;
  color: #3FCDFA;
  padding: 1px 6px;
  border-radius: 3px;
}
</style>
