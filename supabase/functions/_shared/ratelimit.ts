import { Ratelimit } from 'https://esm.sh/@upstash/ratelimit@2'
import { Redis } from 'https://esm.sh/@upstash/redis@1'

function createRedis(): Redis {
  return new Redis({
    url: Deno.env.get('UPSTASH_REDIS_REST_URL')!,
    token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!,
  })
}

export function createRateLimiter(
  prefix: string,
  limit: number,
  window: `${number} s` | `${number} m`,
): Ratelimit {
  return new Ratelimit({
    redis: createRedis(),
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix,
  })
}

/**
 * Named limiters — single source of truth for rate limit configuration.
 * "votes" is shared across submit-vote and vote-question per FR-013.
 */
export const questionsLimiter = createRateLimiter('questions', 3, '60 s')
export const votesLimiter = createRateLimiter('votes', 30, '60 s')
