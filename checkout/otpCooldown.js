// The resend cooldown ladder, mirrored from the server.
//
// The backend now sets Retry-After on the 429, so the exact wait is known when
// a limit is actually hit. This ladder covers the other case: after a
// *successful* send, the button must already know how long the next one is
// blocked for, and no response says so.
//
// otp.DefaultConfig: {60s, 5m, 30m}, the last repeating.

import { readJson, removeKey, writeJson } from '../lib/storage.js';

const KEY = 'la3_otp';
const LADDER = [60_000, 5 * 60_000, 30 * 60_000];

function rung(sentCount) {
  return LADDER[Math.min(sentCount - 1, LADDER.length - 1)] ?? LADDER[0];
}

function read(scope) {
  const all = readJson(sessionStorage, KEY, null);
  return all?.[scope] ?? null;
}

function write(scope, value) {
  const all = readJson(sessionStorage, KEY, null) ?? {};
  writeJson(sessionStorage, KEY, { ...all, [scope]: value });
}

/**
 * @param {string} scope  the draft id, or the contact for order lookup — the
 *   two OTP purposes share one per-contact budget server-side, but their
 *   cooldowns are tracked against different challenges.
 */
export function recordSend(scope) {
  const prev = read(scope);
  const sentCount = (prev?.sentCount ?? 0) + 1;
  const state = { sentCount, nextAllowedAt: new Date(Date.now() + rung(sentCount)).toISOString() };
  write(scope, state);
  return state;
}

/** After a 429 the server tells us exactly how long to wait. Believe it. */
export function recordRetryAfter(scope, seconds) {
  const prev = read(scope) ?? { sentCount: 0 };
  const state = {
    ...prev,
    nextAllowedAt: new Date(Date.now() + seconds * 1000).toISOString(),
  };
  write(scope, state);
  return state;
}

export function cooldown(scope) {
  return read(scope);
}

export function clearCooldown(scope) {
  const all = readJson(sessionStorage, KEY, null);
  if (!all) return;
  delete all[scope];
  if (Object.keys(all).length === 0) removeKey(sessionStorage, KEY);
  else writeJson(sessionStorage, KEY, all);
}
