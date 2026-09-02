// The track token is returned exactly once, by POST /checkout/otp/verify, and
// is stored server-side only as a SHA-256 hash. No endpoint can give it back —
// not tracking, not the OTP order lookup. If this list loses it, the buyer's
// only remaining copy is the link in their confirmation email.
//
// That makes writing here the single most important side effect in the app.

import { readJson, writeJson } from '../lib/storage.js';

const KEY = 'la3_orders';
const VERSION = 1;
const MAX = 20;

function read() {
  const stored = readJson(localStorage, KEY, null);
  if (!stored || stored.v !== VERSION || !Array.isArray(stored.orders)) {
    return [];
  }
  return stored.orders.filter((o) => o && typeof o.token === 'string' && o.token);
}

/** Orders placed on this device, newest first. */
export function listOrders() {
  return read();
}

/**
 * Records a placed order. Call this before navigating, before setState, before
 * anything that can throw.
 *
 * @returns {boolean} false when storage refused the write — the caller must
 *   then keep the tracking link visible on screen rather than assume it is safe.
 */
export function rememberOrder({ token, number, total, placedAt }) {
  if (!token) return false;
  const existing = read().filter((o) => o.token !== token);
  const next = [{ token, number, total, placedAt: placedAt || new Date().toISOString() }, ...existing];
  return writeJson(localStorage, KEY, { v: VERSION, orders: next.slice(0, MAX) });
}

/**
 * Drops one order from the device list.
 *
 * Only for a token the server has answered 404 to: the row points at nothing,
 * and leaving it there means a buyer clicking their own order history lands on
 * "Pesanan tidak ditemukan" with no way to clear it. Removing anything else
 * would destroy the buyer's only copy of a tracking token — see the note at
 * the top of this file.
 *
 * @returns {boolean} false when storage refused the write.
 */
export function forgetOrder(token) {
  if (!token) return false;
  const next = read().filter((o) => o.token !== token);
  return writeJson(localStorage, KEY, { v: VERSION, orders: next });
}

const TOKEN_RE = /[A-Z2-7]{26}/;

/**
 * Accepts a bare token or a pasted tracking link.
 *
 * Tokens are base32 with no padding and always uppercase, and the server
 * compares them case-sensitively. Upper-casing is therefore a no-op on a
 * correct token and rescues one typed in lower case; lower-casing would break
 * every token, so it must never happen anywhere in the routing path.
 */
export function extractToken(input) {
  const s = String(input || '').trim().toUpperCase();
  const m = s.match(TOKEN_RE);
  return m ? m[0] : null;
}
