export function validateQuestionContent(text: string): { valid: boolean; error: string | null } {
  const trimmed = text.trim()

  if (trimmed.length === 0) {
    return { valid: false, error: 'Question cannot be empty' }
  }

  if (trimmed.length > 300) {
    return { valid: false, error: 'Question too long' }
  }

  // Reject repeated characters (e.g., "aaaaaaa", "!!!!!")
  // Check if content is 5+ of the same character
  if (/^(.)\1{4,}$/.test(trimmed)) {
    return { valid: false, error: 'Invalid question content' }
  }

  // Reject excessive repetition patterns (e.g., "abababab")
  if (/^(.{1,3})\1{4,}$/.test(trimmed)) {
    return { valid: false, error: 'Invalid question content' }
  }

  // Reject content that's purely whitespace/punctuation with no meaningful words
  const meaningful = trimmed.replace(/[\s\p{P}\p{S}]/gu, '')
  if (meaningful.length === 0) {
    return { valid: false, error: 'Invalid question content' }
  }

  return { valid: true, error: null }
}
