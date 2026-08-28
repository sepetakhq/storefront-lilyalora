// Draft and idempotency state, scoped to the tab.
//
// sessionStorage rather than localStorage: a draft is tab-scoped and dies in
// 30 minutes. Its job is surviving an accidental reload on the confirmation
// screen so the buyer does not lose a draft they already spent a code on.

import { readJson, removeKey, writeJson } from '../lib/storage.js';

const DRAFT_KEY = 'la3_checkout';
const IDEM_KEY = 'la3_ck_idem';
const VERSION = 1;

export function loadCheckout() {
  const stored = readJson(sessionStorage, DRAFT_KEY, null);
  if (!stored || stored.v !== VERSION || !stored.draftId) return null;
  // A draft the server has already expired is worse than none: acting on it
  // produces a 409 the buyer cannot interpret.
  if (stored.expiresAt && Date.parse(stored.expiresAt) < Date.now()) {
    clearCheckout();
    return null;
  }
  return stored;
}

export function saveCheckout(state) {
  writeJson(sessionStorage, DRAFT_KEY, { v: VERSION, ...state });
}

export function clearCheckout() {
  removeKey(sessionStorage, DRAFT_KEY);
  removeKey(sessionStorage, IDEM_KEY);
}

/**
 * The Idempotency-Key binds to a hash of `{draft_id, code}`:
 *
 *   - same key + same code  → replay, returning the stored 201 verbatim. This
 *     is what makes a double-tapped "Verifikasi" safe, and it is the only way
 *     to recover a track token from a response that never arrived.
 *   - same key + different code → 422, a hard failure the buyer cannot act on.
 *
 * So a key is minted per distinct code and reused only for that same code.
 * It is written BEFORE the request goes out — the entire point is surviving a
 * response you never receive.
 */
export function keyForAttempt(draftId, code) {
  const stored = readJson(sessionStorage, IDEM_KEY, null);
  if (stored?.draftId === draftId && stored?.code === code && stored?.key) {
    return stored.key;
  }
  const key = newKey();
  writeJson(sessionStorage, IDEM_KEY, { draftId, code, key });
  return key;
}

/** Used after a 422, where the stored key is known to be unusable. */
export function resetKeyForAttempt(draftId, code) {
  removeKey(sessionStorage, IDEM_KEY);
  return keyForAttempt(draftId, code);
}

/** The pending attempt, if a reload interrupted one. */
export function pendingAttempt() {
  return readJson(sessionStorage, IDEM_KEY, null);
}

function newKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
