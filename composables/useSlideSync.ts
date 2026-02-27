import { ref, watch, onUnmounted } from 'vue'
import { useSupabase } from './useSupabase'
import { usePresenterAuth } from './usePresenterAuth'
import { FUNCTIONS_BASE, BROADCAST_CHANNEL, SLIDE_CHANGE_EVENT } from '../lib/constants'
import type { RealtimeChannel } from '@supabase/supabase-js'

const currentSlide = ref(1)
let channel: RealtimeChannel | null = null

export function useSlideSync() {
  const { supabase } = useSupabase()
  const { isPresenter, getAuthHeaders } = usePresenterAuth()

  /**
   * Presenter: broadcast slide changes via Edge Function
   */
  async function syncSlide(slideNumber: number) {
    if (!isPresenter.value) return

    currentSlide.value = slideNumber

    try {
      await fetch(`${FUNCTIONS_BASE}/sync-slide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ slide_number: slideNumber }),
      })
    } catch {
      // Fail silently — slides work without backend
    }
  }

  /**
   * Presenter: watch Slidev navigation and sync
   */
  function watchPresenterNav(currentPageRef: { value: number }) {
    watch(() => currentPageRef.value, (page) => {
      syncSlide(page)
    })
  }

  /**
   * Audience: subscribe to slide-change broadcasts
   */
  function subscribeAudience(sessionId: string) {
    if (!supabase) return

    channel = supabase
      .channel(BROADCAST_CHANNEL)
      .on('broadcast', { event: SLIDE_CHANGE_EVENT }, (payload) => {
        if (payload.payload?.slide) {
          currentSlide.value = payload.payload.slide
        }
      })
      .subscribe()

    // Late-join: fetch current slide from session
    supabase
      .from('sessions')
      .select('current_slide')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => {
        if (data?.current_slide) {
          currentSlide.value = data.current_slide
        }
      })
  }

  function cleanup() {
    if (channel && supabase) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  onUnmounted(cleanup)

  return {
    currentSlide,
    syncSlide,
    watchPresenterNav,
    subscribeAudience,
    cleanup,
  }
}
