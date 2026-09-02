import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';

import {
  getHome,
  getProduct,
  listCategories,
  listProducts,
  trackOrder,
} from '../api/endpoints.js';
import { qk } from '../api/queryKeys.js';
import { serverNow } from '../api/client.js';

const PAGE_SIZE = 12;

export function useHome() {
  return useQuery({
    queryKey: qk.home,
    queryFn: ({ signal }) => getHome(signal),
    // Short: this payload carries live campaign products and their end time,
    // so a campaign switching off should be noticed quickly.
    staleTime: 60_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: ({ signal }) => listCategories(signal),
    staleTime: 30 * 60_000,
  });
}

/**
 * The API returns no total and no has_more, so the end of the list is a page
 * shorter than the page size. That holds for price sorts too — they sort the
 * scan and then slice by offset.
 */
export function useProducts(params) {
  return useInfiniteQuery({
    queryKey: qk.products(params),
    queryFn: ({ pageParam = 0, signal }) =>
      listProducts({ ...params, limit: PAGE_SIZE, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      (last?.products?.length ?? 0) < PAGE_SIZE ? undefined : (last.offset ?? 0) + PAGE_SIZE,
    staleTime: 60_000,
  });
}

export function useProduct(slug) {
  return useQuery({
    queryKey: qk.product(slug),
    queryFn: ({ signal }) => getProduct(slug, signal),
    enabled: Boolean(slug),
    staleTime: 60_000,
  });
}

/**
 * Hydrates cart lines from their slugs.
 *
 * There is no batch-by-id endpoint, so this is N parallel requests — but they
 * share the exact cache entries the product page already filled, so arriving
 * from a product page usually resolves with no network at all.
 */
export function useProductsBySlug(slugs) {
  return useQueries({
    queries: slugs.map((slug) => ({
      queryKey: qk.product(slug),
      queryFn: ({ signal }) => getProduct(slug, signal),
      staleTime: 60_000,
    })),
  });
}

/**
 * Checks a batch of remembered tracking tokens.
 *
 * The device list on /lacak is written from localStorage at checkout and used
 * to be rendered straight back, number and total frozen at the moment of
 * placing. So it showed no status — fourteen expired orders looked exactly
 * like a live one — and it happily listed orders that no longer exist: two
 * rows both reading LA-260829-0001, one of whose tokens 404s.
 *
 * Same shape as useProductsBySlug, and for the same reason: there is no
 * batch-by-token endpoint, but these share the cache entries useOrder fills,
 * so opening an order and coming back resolves without a request.
 *
 * A 404 is final and is not retried — that is the answer, not a failure.
 * Anything else is: a buyer who goes offline must not have their order history
 * appear to delete itself.
 */
export function useOrdersByToken(tokens) {
  return useQueries({
    queries: (tokens ?? []).map((token) => ({
      queryKey: qk.track(token),
      queryFn: ({ signal }) => trackOrder(token, signal),
      staleTime: 30_000,
      retry: (count, err) => (err?.status === 404 ? false : count < 1),
    })),
  });
}

const POLL_GRACE_MS = 3 * 60_000;

/**
 * The order query, and the only channel through which payment confirmation is
 * ever learned — there is no push and no public payment-status endpoint.
 */
export function useOrder(token, { poll = false } = {}) {
  return useQuery({
    queryKey: qk.track(token),
    queryFn: ({ signal }) => trackOrder(token, signal),
    enabled: Boolean(token),
    staleTime: 0,
    // The buyer leaves for their banking app and comes back; that focus event
    // is the likeliest moment for the status to have changed.
    refetchOnWindowFocus: true,
    retry: (count, err) => (err?.status === 404 ? false : count < 2),
    refetchInterval: (query) => {
      if (!poll) return false;
      const data = query.state.data;
      if (!data) return 5_000;
      if (data.order?.status !== 'awaiting_payment') return false;

      const placed = Date.parse(data.order.placed_at);
      const expires = data.order.expires_at ? Date.parse(data.order.expires_at) : null;
      const now = serverNow();

      // Past expiry the worker sweeps once a minute. Keep polling briefly so
      // a payment that landed seconds before the deadline still resolves,
      // then stop rather than hammering a dead order forever.
      if (expires && now > expires) {
        return now - expires < POLL_GRACE_MS ? 10_000 : false;
      }

      const age = Number.isNaN(placed) ? 0 : now - placed;
      if (age < 2 * 60_000) return 5_000;
      if (age < 10 * 60_000) return 10_000;
      return 20_000;
    },
  });
}
