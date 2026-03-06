export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
export const PRESENTER_TOKEN = import.meta.env.VITE_PRESENTER_TOKEN as string

export const MAX_QUESTION_LENGTH = 300
export const RATE_LIMIT_QUESTIONS = 3
export const RATE_LIMIT_VOTES = 30
export const RATE_LIMIT_WINDOW_SECONDS = 60

export const BROADCAST_CHANNEL = 'presentation-live'
export const SLIDE_CHANGE_EVENT = 'slide-change'

export const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`
