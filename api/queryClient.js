import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './client.js';

/**
 * Retry only what a retry can actually fix.
 *
 * Every 4xx this API returns is semantic — a wrong OTP, an expired draft, a
 * stock conflict — and repeating the request changes nothing. Retrying 429 is
 * worse than useless: it spends the buyer's five-codes-per-hour budget and
 * escalates their cooldown from 60s to 5 minutes.
 *
 * 503 is excluded for the same reason. The only 503 on a buyer path is a
 * failed OTP delivery, which discards the challenge but does NOT refund the
 * rate-limit unit — so a silent retry burns budget invisibly.
 */
function retry(failureCount, error) {
  if (!(error instanceof ApiError)) return false;
  if (error.isNetwork) return failureCount < 2;
  if (error.status >= 500 && error.status !== 503) return failureCount < 2;
  return false;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
        // No endpoint sets Cache-Control or ETag, so the browser cache does
        // nothing here and this in-memory cache is the whole caching story.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchIntervalInBackground: false,
      },
      mutations: {
        // Never automatic. Checkout mutations are either precious (OTP sends)
        // or destructive to repeat without a key we control (verify).
        retry: false,
      },
    },
  });
}
