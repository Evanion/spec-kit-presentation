<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useSupabase } from '../../../composables/useSupabase'
import { useDeviceId } from '../../../composables/useDeviceId'
import { FUNCTIONS_BASE } from '../../../lib/constants'
import type { Poll } from '../../../lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

const props = defineProps<{
  poll: Poll
}>()

const { supabase } = useSupabase()
const deviceId = useDeviceId()

const selectedOption = ref<number | null>(null)
const submitting = ref(false)
const pollClosed = ref(props.poll.status === 'closed')
const confirmation = ref('')

let channel: RealtimeChannel | null = null

async function vote(optionIndex: number) {
  if (submitting.value || pollClosed.value) return

  submitting.value = true
  confirmation.value = ''

  try {
    const response = await fetch(`${FUNCTIONS_BASE}/submit-vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poll_id: props.poll.id,
        device_id: deviceId,
        selected_option: optionIndex,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      selectedOption.value = optionIndex
      confirmation.value = data.vote.changed ? 'Vote changed!' : 'Vote recorded!'
    } else {
      const err = await response.json()
      if (response.status === 403) {
        pollClosed.value = true
      }
      confirmation.value = err.error || 'Failed to vote'
    }
  } catch {
    confirmation.value = 'Connection error — try again'
  } finally {
    submitting.value = false
  }
}

// Fetch existing vote on mount
async function fetchExistingVote() {
  if (!supabase) return

  const { data } = await supabase
    .from('poll_votes')
    .select('selected_option')
    .eq('poll_id', props.poll.id)
    .eq('device_id', deviceId)
    .single()

  if (data) {
    selectedOption.value = data.selected_option
  }
}

// Subscribe to poll status changes
function subscribeToPollStatus() {
  if (!supabase) return

  channel = supabase
    .channel(`poll-status-${props.poll.id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'polls',
        filter: `id=eq.${props.poll.id}`,
      },
      (payload) => {
        if (payload.new?.status === 'closed') {
          pollClosed.value = true
        }
      },
    )
    .subscribe()
}

onMounted(() => {
  fetchExistingVote()
  subscribeToPollStatus()
})

onUnmounted(() => {
  if (channel && supabase) {
    supabase.removeChannel(channel)
  }
})
</script>

<template>
  <div class="audience-poll">
    <h2 class="poll-question">{{ poll.question }}</h2>

    <div v-if="pollClosed" class="poll-closed" role="status">
      Poll closed — thanks for voting!
    </div>

    <div v-else class="poll-options" role="group" :aria-label="poll.question">
      <button
        v-for="(option, i) in (poll.options as string[])"
        :key="i"
        class="poll-option-btn"
        :class="{ selected: selectedOption === i }"
        :disabled="submitting"
        :aria-pressed="selectedOption === i"
        @click="vote(i)"
      >
        {{ option }}
      </button>
    </div>

    <p v-if="confirmation" class="poll-confirmation" role="status" aria-live="polite">
      {{ confirmation }}
    </p>
  </div>
</template>

<style scoped>
.audience-poll {
  padding: 8px 0;
}

.poll-question {
  font-size: 1.2rem;
  color: #3FCDFA;
  font-weight: 700;
  margin-bottom: 20px;
  font-family: 'Century Gothic', 'Segoe UI', sans-serif;
}

.poll-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.poll-option-btn {
  display: block;
  width: 100%;
  padding: 14px 16px;
  background: #3C3C46;
  color: #DADCF1;
  border: 2px solid transparent;
  border-radius: 8px;
  font-family: 'Century Gothic', 'Segoe UI', sans-serif;
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  min-height: 44px;
}

.poll-option-btn:hover:not(:disabled) {
  border-color: #0099CC;
}

.poll-option-btn:focus-visible {
  outline: 2px solid #3FCDFA;
  outline-offset: 2px;
}

.poll-option-btn.selected {
  border-color: #0099CC;
  background: #0099CC22;
}

.poll-option-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.poll-closed {
  padding: 24px;
  text-align: center;
  color: #DADCF1;
  opacity: 0.7;
  font-size: 0.95rem;
}

.poll-confirmation {
  margin-top: 12px;
  text-align: center;
  font-size: 0.85rem;
  color: #4CAF50;
}
</style>
