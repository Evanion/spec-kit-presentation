<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSupabase } from '../../../composables/useSupabase'
import { useDeviceId } from '../../../composables/useDeviceId'
import { FUNCTIONS_BASE, MAX_QUESTION_LENGTH } from '../../../lib/constants'
import type { Question } from '../../../lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

const props = defineProps<{
  sessionId: string
}>()

const { supabase } = useSupabase()
const deviceId = useDeviceId()

const questions = ref<Question[]>([])
const myVotes = ref<Record<string, number>>({})
const newQuestion = ref('')
const submitting = ref(false)
const submitMessage = ref('')
const submitError = ref(false)

let channel: RealtimeChannel | null = null

const charCount = computed(() => newQuestion.value.length)
const charOver = computed(() => charCount.value > MAX_QUESTION_LENGTH)

async function fetchQuestions() {
  if (!supabase) return

  const { data } = await supabase
    .from('questions')
    .select('*')
    .eq('session_id', props.sessionId)
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })

  if (data) {
    // Client-side filter: exclude hidden questions
    questions.value = data.filter((q: Question) => !q.is_hidden)
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
    .channel(`audience-questions-${props.sessionId}`)
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

async function submitQuestion() {
  if (submitting.value || charOver.value || !newQuestion.value.trim()) return

  submitting.value = true
  submitMessage.value = ''
  submitError.value = false

  try {
    const response = await fetch(`${FUNCTIONS_BASE}/submit-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: props.sessionId,
        device_id: deviceId,
        content: newQuestion.value,
      }),
    })

    if (response.ok) {
      newQuestion.value = ''
      submitMessage.value = 'Question submitted!'
      submitError.value = false
    } else {
      const err = await response.json()
      submitMessage.value = err.error || 'Failed to submit'
      submitError.value = true
    }
  } catch {
    submitMessage.value = 'Connection error — try again'
    submitError.value = true
  } finally {
    submitting.value = false
    setTimeout(() => { submitMessage.value = '' }, 3000)
  }
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
  <div class="audience-questions">
    <!-- Submit form -->
    <form class="question-form" @submit.prevent="submitQuestion">
      <label for="question-input" class="sr-only">Ask a question</label>
      <textarea
        id="question-input"
        v-model="newQuestion"
        class="question-input"
        :class="{ over: charOver }"
        placeholder="Ask a question..."
        :maxlength="MAX_QUESTION_LENGTH + 10"
        rows="2"
        :disabled="submitting"
        aria-label="Ask a question"
      />
      <div class="question-form-footer">
        <span class="char-counter" :class="{ over: charOver }">
          {{ charCount }}/{{ MAX_QUESTION_LENGTH }}
        </span>
        <button
          type="submit"
          class="submit-btn"
          :disabled="submitting || charOver || !newQuestion.trim()"
        >
          {{ submitting ? 'Sending...' : 'Submit' }}
        </button>
      </div>
      <p
        v-if="submitMessage"
        class="submit-feedback"
        :class="{ error: submitError }"
        role="status"
        aria-live="polite"
      >
        {{ submitMessage }}
      </p>
    </form>

    <!-- Question feed -->
    <div class="questions-list">
      <div v-if="questions.length === 0" class="no-questions">
        No questions yet — be the first to ask!
      </div>

      <div v-for="q in questions" :key="q.id" class="q-item" :class="{ answered: q.is_answered }">
        <div class="q-votes">
          <button
            class="vote-btn up"
            :class="{ active: myVotes[q.id] === 1 }"
            :aria-label="`Upvote: ${q.content}`"
            @click="voteQuestion(q.id, 1)"
          >&#9650;</button>
          <span class="vote-score" aria-live="polite">{{ q.score }}</span>
          <button
            class="vote-btn down"
            :class="{ active: myVotes[q.id] === -1 }"
            :aria-label="`Downvote: ${q.content}`"
            @click="voteQuestion(q.id, -1)"
          >&#9660;</button>
        </div>
        <div class="q-content">
          <p class="q-text" v-text="q.content" />
          <span v-if="q.is_answered" class="answered-badge">Answered</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audience-questions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.question-input {
  width: 100%;
  padding: 12px;
  background: #3C3C46;
  color: #DADCF1;
  border: 2px solid transparent;
  border-radius: 8px;
  font-family: 'Century Gothic', 'Segoe UI', sans-serif;
  font-size: 0.95rem;
  resize: none;
}

.question-input:focus-visible {
  outline: 2px solid #3FCDFA;
  outline-offset: 2px;
  border-color: #0099CC;
}

.question-input.over {
  border-color: #ff5722;
}

.question-form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.char-counter {
  font-size: 0.75rem;
  color: #DADCF1;
  opacity: 0.6;
}

.char-counter.over {
  color: #ff5722;
}

.submit-btn {
  padding: 8px 20px;
  background: #0099CC;
  color: #F8F8F8;
  border: none;
  border-radius: 6px;
  font-family: 'Century Gothic', 'Segoe UI', sans-serif;
  font-size: 0.9rem;
  cursor: pointer;
  min-height: 44px;
}

.submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.submit-btn:hover:not(:disabled) {
  background: #00ACE6;
}

.submit-btn:focus-visible {
  outline: 2px solid #3FCDFA;
  outline-offset: 2px;
}

.submit-feedback {
  font-size: 0.8rem;
  color: #4CAF50;
  text-align: center;
  margin: 0;
}

.submit-feedback.error {
  color: #ff5722;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.no-questions {
  text-align: center;
  color: #DADCF1;
  opacity: 0.5;
  padding: 16px;
  font-size: 0.9rem;
}

.q-item {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  background: #3C3C46;
  border-radius: 6px;
  align-items: flex-start;
}

.q-item.answered {
  opacity: 0.6;
}

.q-votes {
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
  min-height: 44px;
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

.q-content {
  flex: 1;
  min-width: 0;
}

.q-text {
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
