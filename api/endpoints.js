// One function per route. The only file that knows path strings.
//
// Two shape normalisations happen here and nowhere else, so no component has
// to remember them:
//   - `payment` is absent on verify (omitempty) but explicitly null on track.
//   - `sections[].cats` is absent when empty (omitempty), unlike grid/campaign
//     products which are always arrays.

import { apiFetch, apiGet, qs } from './client.js';

export const getConfig = (signal) => apiGet('/storefront/config', signal);

export async function getHome(signal) {
  return normalizePage(await apiGet('/storefront/home', signal));
}

export async function getPage(key, signal) {
  return normalizePage(await apiGet(`/storefront/page/${encodeURIComponent(key)}`, signal));
}

export const listCategories = async (signal) =>
  (await apiGet('/categories', signal))?.categories ?? [];

export const listProducts = (params, signal) => apiGet(`/products${qs(params)}`, signal);

export const getProduct = (slug, signal) =>
  apiGet(`/products/${encodeURIComponent(slug)}`, signal);

/**
 * Resolves what the buyer typed into a shippable location.
 *
 * The provider quotes from an opaque location id, not from an address, so the
 * free-text city field cannot reach it: something has to turn "kemayoran" into
 * an id first, and that is this.
 */
export const searchDestinations = async (q, signal) =>
  (await apiFetch('/shipping/destinations', { method: 'POST', body: { q }, signal })).data
    ?.results ?? [];

/**
 * Turns a picked place into a quotable destination.
 *
 * Separate from the search above because the two cost different things:
 * searching reads the server's own list of Indonesian places and is free, so
 * it can run on every keystroke, while this asks the couriers for their own id
 * and runs once, when the buyer chooses. A place resolved once stays resolved
 * for everyone.
 *
 * Throws ApiError(409, 'destination_unserved') when no courier serves the
 * place; `details.alternatives` then carries nearby ones that are served.
 */
export const resolveDestination = async (ref, signal) =>
  (await apiFetch('/shipping/destinations/resolve', { method: 'POST', body: { ref }, signal }))
    .data;

/**
 * Prices this cart to one destination.
 *
 * The options come back carrying a quote id each. That id, not a price, is
 * what checkout submits — the server charges what it stored, so there is
 * nothing here for a client to usefully alter.
 */
export const getShippingRates = async (body, signal) =>
  (await apiFetch('/shipping/rates', { method: 'POST', body, signal })).data;

export const createDraft = async (body, signal) =>
  (await apiFetch('/checkout/draft', { method: 'POST', body, signal })).data;

export const sendCheckoutCode = async (draftId, signal) =>
  (await apiFetch('/checkout/otp/send', { method: 'POST', body: { draft_id: draftId }, signal })).data;

/**
 * Returns `{ data, meta }` rather than just the body: the caller has to know
 * whether this was an idempotent replay, and the track token in `data` is
 * returned exactly once and is unrecoverable if dropped.
 */
export const verifyCheckoutCode = (draftId, code, idempotencyKey, signal) =>
  apiFetch('/checkout/otp/verify', {
    method: 'POST',
    body: { draft_id: draftId, code },
    idempotencyKey,
    signal,
  });

export async function trackOrder(token, signal) {
  // Tokens are base32 uppercase and case-sensitive — never normalise the case.
  const res = await apiGet(`/orders/track/${encodeURIComponent(token)}`, signal);
  return { order: res.order, payment: res.payment ?? null };
}

/**
 * Re-opens the payment for an order whose instructions never arrived.
 *
 * No body: the amount, the method and the deadline are the order's and the
 * gateway is the platform's, so there is nothing here a client could usefully
 * send — or get wrong. Returns the same payment shape `trackOrder` does, so
 * the caller writes it straight into the tracked-order cache.
 */
export const reopenPayment = async (token, signal) =>
  (
    await apiFetch(`/orders/track/${encodeURIComponent(token)}/payment`, {
      method: 'POST',
      signal,
    })
  ).data?.payment ?? null;

/**
 * Tells the shop the buyer has paid a manual order.
 *
 * Proves nothing — the shop still checks their own bank — but it is the only
 * signal a manual payment produces, and it buys the buyer time: the order's
 * deadline moves out once so a transfer made near the end is not expired and
 * restocked while it is in flight.
 *
 * No body, for the same reason `reopenPayment` takes none. Returns the whole
 * `{order, payment}` pair rather than one half, so the page re-renders from
 * one source instead of patching its own state — the claim changes the order
 * (its deadline and its claim time), not the payment.
 */
export const claimPayment = async (token, signal) =>
  (
    await apiFetch(`/orders/track/${encodeURIComponent(token)}/payment/claim`, {
      method: 'POST',
      signal,
    })
  ).data ?? null;

export const sendLookupCode = async (contact, signal) =>
  (await apiFetch('/orders/lookup/otp/send', { method: 'POST', body: { contact }, signal })).data;

export const verifyLookupCode = async (contact, code, signal) =>
  (await apiFetch('/orders/lookup/otp/verify', { method: 'POST', body: { contact, code }, signal }))
    .data?.orders ?? [];

function normalizePage(page) {
  return {
    ...page,
    sections: (page?.sections ?? []).map((s) => ({ ...s, cats: s.cats ?? [] })),
    announcement: page?.announcement ?? { enabled: false, text: '' },
  };
}
