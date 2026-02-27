<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { usePresenterAuth } from '../composables/usePresenterAuth'
import { useSession } from '../composables/useSession'
import { FUNCTIONS_BASE } from '../lib/constants'
import type { Question } from '../lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

const props = withDefaults(defineProps<{
  sessionId?: string
}>(), {
  sessionId: '',
})

const { supabase, isAvailable } = useSupabase()
const { getAuthHeaders } = usePresenterAuth()
const { session } = useSession()

// Resolve session ID: use prop if provided, otherwise get from active session
const resolvedSessionId = computed(() => props.sessionId || session.value?.id || '')

const questions = ref<Question[]>([])

let channel: RealtimeChannel | null = null

async function fetchQuestions() {
  if (!supabase || !resolvedSessionId.value) return

  const { data } = await supabase
    .from('questions')
    .select('*')
    .eq('session_id', resolvedSessionId.value)
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20)

  if (data) {
    questions.value = data
  }
}

function subscribeToChanges() {
  if (!supabase || !resolvedSessionId.value) return

  channel = supabase
    .channel(`top-questions-${resolvedSessionId.value}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'questions', filter: `session_id=eq.${resolvedSessionId.value}` },
      () => fetchQuestions(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'question_votes' },
      () => fetchQuestions(),
    )
    .subscribe()
}

async function manageQuestion(questionId: string, action: 'answer' | 'unanswer' | 'hide' | 'unhide') {
  try {
    await fetch(`${FUNCTIONS_BASE}/manage-question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ question_id: questionId, action }),
    })
    fetchQuestions()
  } catch {
    // Fail silently
  }
}

// Start fetching once session ID is resolved (may be async from session init)
watch(resolvedSessionId, (id) => {
  if (id) {
    fetchQuestions()
    if (channel && supabase) supabase.removeChannel(channel)
    subscribeToChanges()
  }
}, { immediate: true })

onUnmounted(() => {
  if (channel && supabase) {
    supabase.removeChannel(channel)
  }
})
</script>

<template>
  <div class="top-questions" v-if="isAvailable">
    <div v-if="questions.length === 0" class="no-questions">
      No questions submitted yet
    </div>

    <div v-for="q in questions" :key="q.id" class="tq-item" :class="{ answered: q.is_answered, hidden: q.is_hidden }">
      <div class="tq-score">{{ q.score }}</div>
      <div class="tq-content">
        <p class="tq-text" v-text="q.content" />
        <div class="tq-badges">
          <span v-if="q.is_answered" class="badge answered">Answered</span>
          <span v-if="q.is_hidden" class="badge hidden-badge">Hidden</span>
        </div>
      </div>
      <div class="tq-actions">
        <button
          v-if="!q.is_answered"
          class="tq-btn"
          title="Mark as answered"
          @click="manageQuestion(q.id, 'answer')"
        >&#10004;</button>
        <button
          v-else
          class="tq-btn"
          title="Unmark as answered"
          @click="manageQuestion(q.id, 'unanswer')"
        >&#8634;</button>
        <button
          v-if="!q.is_hidden"
          class="tq-btn"
          title="Hide question"
          @click="manageQuestion(q.id, 'hide')"
        >&#128065;</button>
        <button
          v-else
          class="tq-btn"
          title="Unhide question"
          @click="manageQuestion(q.id, 'unhide')"
        >&#128064;</button>
      </div>
    </div>
  </div>

  <div v-else class="tq-unavailable">
    Questions unavailable
  </div>
</template>

<style scoped>
.top-questions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 350px;
  overflow-y: auto;
}

.no-questions {
  text-align: center;
  color: #DADCF1;
  opacity: 0.5;
  padding: 16px;
  font-size: 0.85rem;
}

.tq-item {
  display: flex;
  gap: 10px;
  padding: 8px 10px;
  background: #3C3C46;
  border-radius: 4px;
  align-items: center;
}

.tq-item.answered {
  opacity: 0.5;
}

.tq-item.hidden {
  border-left: 3px solid #ff5722;
}

.tq-score {
  font-size: 0.9rem;
  font-weight: 700;
  color: #3FCDFA;
  min-width: 28px;
  text-align: center;
}

.tq-content {
  flex: 1;
  min-width: 0;
}

.tq-text {
  color: #DADCF1;
  font-size: 0.8rem;
  margin: 0;
  word-break: break-word;
}

.tq-badges {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}

.badge {
  font-size: 0.6rem;
  padding: 1px 5px;
  border-radius: 2px;
}

.badge.answered {
  background: #0099CC33;
  color: #3FCDFA;
}

.badge.hidden-badge {
  background: #ff572233;
  color: #ff5722;
}

.tq-actions {
  display: flex;
  gap: 4px;
}

.tq-btn {
  background: #4D4E5C;
  border: none;
  color: #DADCF1;
  font-size: 0.7rem;
  padding: 4px 6px;
  border-radius: 3px;
  cursor: pointer;
  min-width: 28px;
  min-height: 28px;
}

.tq-btn:hover {
  background: #0099CC;
}

.tq-unavailable {
  text-align: center;
  color: #DADCF1;
  opacity: 0.5;
  padding: 16px;
  font-size: 0.85rem;
}
</style>
