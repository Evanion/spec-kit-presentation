<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { usePresenterAuth } from '../composables/usePresenterAuth'
import { useSession } from '../composables/useSession'
import { FUNCTIONS_BASE } from '../lib/constants'
import type { Poll, PollVote } from '../lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

const props = withDefaults(defineProps<{
  pollId?: string
  slideNumber?: number
  question: string
  options: string[]
  status?: string
}>(), {
  pollId: '',
  slideNumber: 0,
})

const { supabase, isAvailable } = useSupabase()
const { isPresenter, getAuthHeaders } = usePresenterAuth()
const { getPollForSlide } = useSession()

// Resolve poll ID: use prop if provided, otherwise look up by slide number
const resolvedPollId = computed(() => {
  if (props.pollId) return props.pollId
  if (props.slideNumber) {
    const poll = getPollForSlide(props.slideNumber)
    return poll?.id || ''
  }
  return ''
})

const voteCounts = ref<number[]>(props.options.map(() => 0))
const totalVotes = computed(() => voteCounts.value.reduce((a, b) => a + b, 0))
const pollStatus = ref(props.status || 'open')

let channel: RealtimeChannel | null = null

async function fetchVotes() {
  if (!supabase || !resolvedPollId.value) return

  const { data } = await supabase
    .from('poll_votes')
    .select('selected_option')
    .eq('poll_id', resolvedPollId.value)

  if (data) {
    const counts = props.options.map(() => 0)
    data.forEach((v: any) => {
      if (v.selected_option >= 0 && v.selected_option < counts.length) {
        counts[v.selected_option]++
      }
    })
    voteCounts.value = counts
  }
}

function subscribeToVotes() {
  if (!supabase || !resolvedPollId.value) return

  channel = supabase
    .channel(`poll-votes-${resolvedPollId.value}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'poll_votes',
        filter: `poll_id=eq.${resolvedPollId.value}`,
      },
      () => {
        // Re-aggregate on any change
        fetchVotes()
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'polls',
        filter: `id=eq.${resolvedPollId.value}`,
      },
      (payload) => {
        if (payload.new?.status) {
          pollStatus.value = payload.new.status
        }
      },
    )
    .subscribe()
}

async function closePoll() {
  if (!resolvedPollId.value) return
  try {
    await fetch(`${FUNCTIONS_BASE}/manage-poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ poll_id: resolvedPollId.value, action: 'close' }),
    })
    pollStatus.value = 'closed'
  } catch {
    // Fail silently
  }
}

function getPercentage(count: number): number {
  if (totalVotes.value === 0) return 0
  return Math.round((count / totalVotes.value) * 100)
}

// Start fetching once poll ID is resolved (may be async from session init)
watch(resolvedPollId, (id) => {
  if (id) {
    fetchVotes()
    if (channel && supabase) supabase.removeChannel(channel)
    subscribeToVotes()
  }
}, { immediate: true })

onUnmounted(() => {
  if (channel && supabase) {
    supabase.removeChannel(channel)
  }
})
</script>

<template>
  <div class="poll-results" v-if="isAvailable">
    <div class="poll-question">{{ question }}</div>

    <div class="poll-bars">
      <div v-for="(option, i) in options" :key="i" class="poll-bar-row">
        <div class="poll-bar-label">{{ option }}</div>
        <div class="poll-bar-track">
          <div
            class="poll-bar-fill"
            :style="{ width: `${getPercentage(voteCounts[i])}%` }"
          />
        </div>
        <div class="poll-bar-count">{{ voteCounts[i] }} <span class="poll-bar-pct">({{ getPercentage(voteCounts[i]) }}%)</span></div>
      </div>
    </div>

    <div class="poll-footer">
      <span class="poll-total">{{ totalVotes }} vote{{ totalVotes !== 1 ? 's' : '' }}</span>
      <span v-if="pollStatus === 'closed'" class="poll-closed-badge">Poll Closed</span>
      <button
        v-if="isPresenter && pollStatus === 'open'"
        class="poll-close-btn"
        @click="closePoll"
      >
        Close Poll
      </button>
    </div>
  </div>

  <div v-else class="poll-unavailable">
    Poll unavailable
  </div>
</template>

<style scoped>
.poll-results {
  padding: 12px 0;
}

.poll-question {
  font-size: 1.1rem;
  color: #3FCDFA;
  font-weight: 700;
  margin-bottom: 16px;
}

.poll-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.poll-bar-row {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  align-items: center;
  gap: 12px;
}

.poll-bar-label {
  font-size: 0.85rem;
  color: #DADCF1;
  text-align: right;
}

.poll-bar-track {
  height: 24px;
  background: #3C3C46;
  border-radius: 4px;
  overflow: hidden;
}

.poll-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #0099CC, #3FCDFA);
  border-radius: 4px;
  transition: width 0.5s ease;
  min-width: 2px;
}

.poll-bar-count {
  font-size: 0.8rem;
  color: #DADCF1;
  min-width: 60px;
}

.poll-bar-pct {
  opacity: 0.6;
}

.poll-footer {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.poll-total {
  font-size: 0.75rem;
  color: #DADCF1;
  opacity: 0.7;
}

.poll-closed-badge {
  font-size: 0.7rem;
  background: #4D4E5C;
  color: #DADCF1;
  padding: 2px 8px;
  border-radius: 3px;
}

.poll-close-btn {
  font-size: 0.7rem;
  background: #4D4E5C;
  color: #DADCF1;
  border: 1px solid #0099CC;
  padding: 3px 10px;
  border-radius: 3px;
  cursor: pointer;
  font-family: inherit;
}

.poll-close-btn:hover {
  background: #0099CC;
}

.poll-unavailable {
  padding: 24px;
  text-align: center;
  color: #DADCF1;
  opacity: 0.5;
  font-size: 0.9rem;
}
</style>
