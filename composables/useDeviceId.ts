const STORAGE_KEY = 'audience-device-id'

let cachedId: string | null = null

export function useDeviceId(): string {
  if (cachedId) return cachedId

  // Try localStorage first
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      cachedId = stored
      return stored
    }
  } catch {
    // localStorage unavailable
  }

  // Try sessionStorage as fallback
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      cachedId = stored
      return stored
    }
  } catch {
    // sessionStorage unavailable
  }

  // Generate new ID
  const id = crypto.randomUUID()
  cachedId = id

  // Persist in localStorage (primary), sessionStorage (fallback)
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    try {
      sessionStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Memory-only
    }
  }

  return id
}
