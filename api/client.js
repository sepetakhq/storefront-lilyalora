// The single door to the API. Everything above this file sees exactly one
// error type and never touches a path string.

// Same origin by default: /api/* is proxied to the Go service in dev and
// served from the tenant's own domain in prod, which is what keeps Host-based
// tenant resolution working and CORS out of the picture. VITE_API_BASE is the
// escape hatch for pointing a local frontend at a staging API.
export const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

// The response shape this bundle was written against.
//
// A source constant, not an env var and not a Vite `define`. Both apps read one
// root .env, so a variable could not differ between the storefront and the
// backoffice even if it should — and it should not. Which shape a client parses
// is a fact about the code that parses it, so moving this is a code change,
// reviewed alongside the components that read the new fields.
//
// The server keeps serving this shape for as long as it is listed in
// backend/internal/apiversion/releases.go, whatever else ships in between.
export const API_VERSION = '2026-09-09';

// Copy for the failures the server never gets to describe itself.
const NETWORK_MESSAGE = 'Koneksi terputus. Periksa internetmu, lalu coba lagi.';
const INTERNAL_MESSAGE = 'Ada gangguan di sisi kami. Coba lagi sebentar lagi.';

/**
 * Every failure that reaches a component is one of these.
 *
 * `message` is the server's own Indonesian copy wherever the server produced
 * one — it is written for buyers and is safe to render as-is. Only the two
 * cases above, where no envelope arrived, use our own words.
 */
export class ApiError extends Error {
  constructor(
    status,
    code,
    message,
    { requestId = null, retryAfter = null, replayed = false, details = null } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
    this.replayed = replayed;
    // The envelope's `details` map. Nothing on the server populates it yet, so
    // this is null in practice — but discarding it here is what would make a
    // future field-level validation error invisible to every caller.
    this.details = details;
  }

  /** No response at all — the request never reached the API. */
  get isNetwork() {
    return this.status === 0;
  }
}

// Server clock offset, refined from the Date header on every response.
//
// It lives here rather than in context because countdowns must be able to read
// it from outside React, and because a buyer who deep-links to an order page
// never fetches /storefront/home and so never sees its `server_time`.
let clockOffsetMs = 0;

export function setClockOffset(ms) {
  if (Number.isFinite(ms)) clockOffsetMs = ms;
}

/** Now, corrected for a wrong device clock. */
export function serverNow() {
  return Date.now() + clockOffsetMs;
}

function readClockFrom(res) {
  const date = res.headers.get('Date');
  if (!date) return;
  const parsed = Date.parse(date);
  if (!Number.isNaN(parsed)) clockOffsetMs = parsed - Date.now();
}

function parseRetryAfter(res) {
  const raw = res.headers.get('Retry-After');
  if (!raw) return null;
  const secs = Number(raw);
  return Number.isFinite(secs) && secs >= 0 ? secs : null;
}

/**
 * @param {string} path      joined onto API_BASE, e.g. '/products/voal-butter'
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {unknown} [options.body]            JSON-serialised when present
 * @param {AbortSignal} [options.signal]
 * @param {string} [options.idempotencyKey]   only checkout verify uses this
 * @param {Record<string,string>} [options.headers]
 *   Extra headers merged over the defaults. The storefront never passes any;
 *   it exists so the backoffice can attach its CSRF token without this module
 *   knowing anything about sessions or where they are kept.
 * @param {'omit'|'include'|'same-origin'} [options.credentials]
 *   Defaults to 'omit', which is what most of the storefront wants: order
 *   access there is a capability token in the URL, so there is nothing for a
 *   browser to attach. The two checkout calls pass 'same-origin' to carry the
 *   trust cookie that lets a browser which already verified skip the code, and
 *   the backoffice passes 'include' to send its session cookie.
 */
export async function apiFetch(
  path,
  {
    method = 'GET',
    body,
    signal,
    idempotencyKey,
    headers: extraHeaders,
    credentials = 'omit',
  } = {},
) {
  const headers = {
    Accept: 'application/json',
    // Echoed back on the response and logged server-side, so a screenshot of a
    // failure becomes a log query. It is one of the four headers CORS allows.
    'X-Request-ID': requestId(),
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  // Merged last so a caller can override Accept or Content-Type deliberately.
  if (extraHeaders) Object.assign(headers, extraHeaders);
  // After the merge, not beside the defaults above: the pinned version is not
  // a default a caller may override. A caller that could unpin itself would
  // silently start receiving a shape it does not parse.
  //
  // Sent on backoffice requests too, since adminFetch funnels through here.
  // The server ignores it on /api/v1/admin, which is deliberate — the
  // backoffice ships with its own API and needs no version contract.
  headers['X-API-Version'] = API_VERSION;

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials,
    });
  } catch (err) {
    // An abort is control flow, not a failure — TanStack Query needs to see it.
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, 'network', NETWORK_MESSAGE);
  }

  readClockFrom(res);

  const meta = {
    requestId: res.headers.get('X-Request-ID'),
    retryAfter: parseRetryAfter(res),
    replayed: res.headers.get('Idempotent-Replay') === 'true',
  };

  if (res.status === 204) return { data: null, meta };

  const payload = await readJson(res);

  if (!res.ok) {
    // A proxy sitting in front of the API returns HTML, not our envelope.
    const envelope = payload?.error;
    throw new ApiError(
      res.status,
      envelope?.code || 'internal',
      envelope?.message || INTERNAL_MESSAGE,
      { ...meta, details: envelope?.details ?? null },
    );
  }

  return { data: payload, meta };
}

/** The common case: callers that only want the body. */
export async function apiGet(path, signal) {
  const { data } = await apiFetch(path, { signal });
  return data;
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function requestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Build a query string, dropping empty values so keys stay stable. */
export function qs(params) {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue;
    out.set(k, String(v));
  }
  const s = out.toString();
  return s ? `?${s}` : '';
}
