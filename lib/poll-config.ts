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
    slideNumber: 7,
    question: 'How often does AI-generated code match what you actually wanted?',
    options: [
      'Almost always',
      'About half the time',
      'Rarely',
      "I've stopped hoping",
    ],
  },
  {
    slideNumber: 11,
    question: 'Would you try spec-driven development on your next feature?',
    options: [
      'Yes, immediately',
      'Maybe, need to see more',
      'Not convinced yet',
      'Already doing something similar',
    ],
  },
  {
    slideNumber: 17,
    question: 'After hearing the objections and responses, where do you stand?',
    options: [
      'More convinced than before',
      'About the same',
      'Less convinced',
      'Need to try it first',
    ],
  },
]
