import { ref, readonly } from 'vue'
import { usePresenterAuth } from './usePresenterAuth'
import { FUNCTIONS_BASE } from '../lib/constants'
import type { Session, Poll, PollConfig, CreateSessionResponse } from '../lib/types'

const session = ref<Pick<Session, 'id' | 'status' | 'current_slide' | 'created_at'> | null>(null)
const polls = ref<Array<Pick<Poll, 'id' | 'slide_number' | 'question' | 'options' | 'status'>>>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useSession() {
  const { isPresenter, getAuthHeaders } = usePresenterAuth()

  async function initSession(pollConfigs: PollConfig[] = []): Promise<void> {
    if (!isPresenter.value) return
    if (session.value) return // Already initialized

    loading.value = true
    error.value = null

    try {
      const response = await fetch(`${FUNCTIONS_BASE}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          polls: pollConfigs.map((p) => ({
            slide_number: p.slideNumber,
            question: p.question,
            options: p.options,
          })),
        }),
      })

      if (!response.ok) {
        const body = await response.json()
        error.value = body.error || 'Failed to create session'
        return
      }

      const data: CreateSessionResponse = await response.json()
      session.value = data.session
      polls.value = data.polls
    } catch (e) {
      error.value = 'Backend unavailable'
    } finally {
      loading.value = false
    }
  }

  async function endSession(): Promise<void> {
    if (!session.value) return

    try {
      const response = await fetch(`${FUNCTIONS_BASE}/session/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      })

      if (response.ok) {
        const data = await response.json()
        session.value = { ...session.value!, status: 'ended' }
      }
    } catch {
      // Fail silently
    }
  }

  async function resetSession(): Promise<void> {
    if (!session.value) return

    try {
      const response = await fetch(`${FUNCTIONS_BASE}/session/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      })

      if (response.ok) {
        const data = await response.json()
        session.value = data.session
        // Re-open all polls locally
        polls.value = polls.value.map((p) => ({ ...p, status: 'open' as const }))
      }
    } catch {
      // Fail silently
    }
  }

  function getPollForSlide(slideNumber: number) {
    return polls.value.find((p) => p.slide_number === slideNumber) || null
  }

  return {
    session: readonly(session),
    polls: readonly(polls),
    loading: readonly(loading),
    error: readonly(error),
    initSession,
    endSession,
    resetSession,
    getPollForSlide,
  }
}
