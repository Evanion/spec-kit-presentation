<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSupabase } from '../../composables/useSupabase'
import { useDeviceId } from '../../composables/useDeviceId'
import { BROADCAST_CHANNEL, SLIDE_CHANGE_EVENT } from '../../lib/constants'
import type { Session, Poll } from '../../lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'
import StatusMessage from './components/StatusMessage.vue'
import AudiencePoll from './components/AudiencePoll.vue'
import AudienceQuestions from './components/AudienceQuestions.vue'

const { supabase, connectionState, isAvailable } = useSupabase()
const deviceId = useDeviceId()

const session = ref<Session | null>(null)
const currentSlide = ref(1)
const activePoll = ref<Poll | null>(null)
const loading = ref(true)
const sessionStatus = ref<'loading' | 'active' | 'waiting' | 'ended'>('loading')

let slideChannel: RealtimeChannel | null = null
let sessionChannel: RealtimeChannel | null = null

async function fetchSession() {
  if (!supabase) {
    sessionStatus.value = 'waiting'
    loading.value = false
    return
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    sessionStatus.value = 'waiting'
    loading.value = false
    return
  }

  session.value = data
  currentSlide.value = data.current_slide
  sessionStatus.value = data.status === 'ended' ? 'ended' : 'active'
  loading.value = false

  // Fetch active poll for current slide
  await fetchPollForSlide(data.id, data.current_slide)

  // Subscribe to slide changes
  subscribeToSlideSync()

  // Subscribe to session status changes
  subscribeToSessionChanges(data.id)
}

async function fetchPollForSlide(sessionId: string, slideNumber: number) {
  if (!supabase) return

  const { data: poll } = await supabase
    .from('polls')
    .select('*')
    .eq('session_id', sessionId)
    .eq('slide_number', slideNumber)
    .single()

  activePoll.value = poll || null
}

function subscribeToSlideSync() {
  if (!supabase) return

  slideChannel = supabase
    .channel(BROADCAST_CHANNEL)
    .on('broadcast', { event: SLIDE_CHANGE_EVENT }, (payload) => {
      const slide = payload.payload?.slide
      if (typeof slide === 'number') {
        currentSlide.value = slide
        // Check if new slide has a poll
        if (session.value) {
          fetchPollForSlide(session.value.id, slide)
        }
      }
    })
    .subscribe()
}

function subscribeToSessionChanges(sessionId: string) {
  if (!supabase) return

  sessionChannel = supabase
    .channel('session-status')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
      (payload) => {
        if (payload.new) {
          session.value = payload.new as Session
          if (payload.new.status === 'ended') {
            sessionStatus.value = 'ended'
          }
        }
      },
    )
    .subscribe()
}

onMounted(fetchSession)

onUnmounted(() => {
  if (supabase) {
    if (slideChannel) supabase.removeChannel(slideChannel)
    if (sessionChannel) supabase.removeChannel(sessionChannel)
  }
})
</script>

<template>
  <div class="audience-app">
    <header class="audience-header">
      <span class="audience-title">Spec-Kit Live</span>
      <span
        class="connection-dot"
        :class="connectionState"
        role="status"
        :aria-label="`Connection: ${connectionState}`"
      />
    </header>

    <main class="audience-main">
      <div v-if="loading" class="audience-loading">
        Connecting...
      </div>

      <StatusMessage
        v-else-if="sessionStatus === 'waiting'"
        type="waiting"
      />

      <StatusMessage
        v-else-if="sessionStatus === 'ended'"
        type="ended"
      />

      <StatusMessage
        v-else-if="connectionState === 'disconnected'"
        type="disconnected"
      />

      <!-- Active session content -->
      <template v-else>
        <!-- Poll view when on a poll slide -->
        <div v-if="activePoll" class="audience-section" id="poll-section">
          <AudiencePoll :poll="activePoll" />
        </div>

        <!-- Question feed (always visible when no poll) -->
        <div v-else class="audience-section" id="questions-section">
          <AudienceQuestions v-if="session" :session-id="session.id" />
        </div>
      </template>
    </main>
  </div>
</template>

<style>
.audience-app {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #272833;
}

.audience-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #3C3C46;
  border-bottom: 2px solid #0099CC;
}

.audience-title {
  font-family: 'Century Gothic', 'Segoe UI', sans-serif;
  font-size: 0.9rem;
  font-weight: 700;
  color: #3FCDFA;
}

.connection-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4CAF50;
}

.connection-dot.disconnected,
.connection-dot.reconnecting {
  background: #ff5722;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.audience-main {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.audience-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #DADCF1;
  font-size: 1rem;
}

.audience-section {
  width: 100%;
}

.placeholder-text {
  text-align: center;
  color: #DADCF1;
  opacity: 0.6;
  padding: 32px;
}
</style>
