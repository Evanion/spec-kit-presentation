import type { PollConfig } from './types'

/**
 * Single source of truth for poll definitions.
 * Maps slide numbers to poll question + options.
 * Used by useSession to seed polls via POST /session
 * and referenced by poll slides in slides.md.
 *
 * Update slide numbers here when slide order changes.
 */
export const pollConfig: PollConfig[] = [
  {
    slideNumber: 9,
    question: "What's your AI planning approach?",
    options: [
      'I spec my kits',
      'Plan mode, more like pain mode',
      'WTF AI can plan?',
    ],
  },
]
