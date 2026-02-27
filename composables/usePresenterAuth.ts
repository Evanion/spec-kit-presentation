import { computed, ref } from 'vue'

const TOKEN_STORAGE_KEY = 'presenter-token'

const token = ref<string | null>(null)

function initToken(): void {
  if (token.value) return

  // Check URL query param
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      token.value = urlToken
      try {
        localStorage.setItem(TOKEN_STORAGE_KEY, urlToken)
      } catch {
        // Storage unavailable
      }
      return
    }

    // Check localStorage
    try {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
      if (stored) {
        token.value = stored
      }
    } catch {
      // Storage unavailable
    }
  }
}

export function usePresenterAuth() {
  initToken()

  const isPresenter = computed(() => !!token.value)

  function getAuthHeaders(): Record<string, string> {
    if (!token.value) return {}
    return {
      Authorization: `Bearer ${token.value}`,
    }
  }

  return {
    isPresenter,
    token,
    getAuthHeaders,
  }
}
