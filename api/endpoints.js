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
