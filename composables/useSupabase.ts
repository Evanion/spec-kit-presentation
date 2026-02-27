import { ref, readonly } from 'vue'
import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/constants'

type ConnectionState = 'connected' | 'disconnected' | 'reconnecting'

let client: SupabaseClient | null = null
const connectionState = ref<ConnectionState>('disconnected')

function getClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
    connectionState.value = 'connected'
  }

  return client
}

export function useSupabase() {
  const supabase = getClient()

  function subscribe(channel: RealtimeChannel): RealtimeChannel {
    return channel
      .on('system' as any, {} as any, (payload: any) => {
        if (payload?.extension === 'system') {
          if (payload.status === 'ok') {
            connectionState.value = 'connected'
          } else {
            connectionState.value = 'reconnecting'
          }
        }
      })
  }

  return {
    supabase,
    connectionState: readonly(connectionState),
    subscribe,
    isAvailable: !!supabase,
  }
}
