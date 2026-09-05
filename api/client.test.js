import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_VERSION, apiFetch } from './client.js';

// Captures the headers each request actually went out with.
function stubFetch(response = { ok: true, status: 200, body: {} }) {
  const calls = [];
  global.fetch = vi.fn(async (url, init) => {
    calls.push({ url, init });
    return {
      ok: response.ok,
      status: response.status,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => response.body,
      text: async () => JSON.stringify(response.body),
    };
  });
  return calls;
}

describe('the pinned API version', () => {
  let realFetch;
  beforeEach(() => {
    realFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
    vi.restoreAllMocks();
  });

  // Without this header the server falls back to the frozen baseline, which is
  // correct but silent: nothing would then distinguish "this build was written
  // against the baseline" from "this build forgot to say", and the telemetry
  // that decides when a version can be retired reads exactly that difference.
  it('rides on every request', async () => {
    const calls = stubFetch();
    await apiFetch('/products');
    expect(calls[0].init.headers['X-API-Version']).toBe(API_VERSION);
  });

  // A caller that could unpin itself would silently start receiving a shape it
  // does not parse. Accept and Content-Type stay overridable on purpose; this
  // one does not.
  it('cannot be overridden by a caller', async () => {
    const calls = stubFetch();
    await apiFetch('/products', { headers: { 'X-API-Version': '1999-01-01' } });
    expect(calls[0].init.headers['X-API-Version']).toBe(API_VERSION);
  });

  // The constant is the client's half of the contract, and it has to be a date
  // the server can parse. "latest" or a semver would be refused outright.
  it('is a canonical YYYY-MM-DD date', () => {
    expect(API_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // The backoffice builds its own headers object and discards whatever a caller
  // passed, so injecting at a call site there would be dropped without a sound.
  // Injecting inside apiFetch is what makes one line cover both apps.
  it('survives the header object adminFetch builds', async () => {
    const calls = stubFetch();
    await apiFetch('/admin/session', {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'abc' },
      credentials: 'include',
    });
    expect(calls[0].init.headers['X-API-Version']).toBe(API_VERSION);
    expect(calls[0].init.headers['X-CSRF-Token']).toBe('abc');
  });
});
