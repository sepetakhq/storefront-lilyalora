// Which build this tab is running, and which one the server is serving.
//
// Vite hashes the entry bundle by content, and each built index.html carries
// exactly one `<script type="module" src="/assets/index-<hash>.js">`. That
// filename IS the version: it changes when, and only when, the bundle changes.
// So there is no version constant to bump alongside a release, no /version
// endpoint to keep in step, and a backend-only deploy correctly reports that
// nothing new is available.
//
// index.html is served no-cache (backend/internal/webui/webui.go), so a plain
// fetch of "/" always reflects what is actually deployed rather than whatever
// this tab loaded hours ago.

/** How long to wait for `/` before abandoning a check. */
const TIMEOUT_MS = 5000;

// Anchored on the src attribute alone: Vite writes `crossorigin` before `src`,
// and the two apps indent their <script> differently (two spaces against four).
// Nothing else in either document points at /assets/index-*.js with a `src`,
// and the stylesheet link uses `href`, so this cannot match it.
const ENTRY = /<script[^>]+src="(\/assets\/index-[^"]+\.js)"/;

/**
 * The entry bundle this document was loaded with, or null if there isn't one.
 *
 * Null is the normal answer in two situations, and neither is an error: under
 * `npm run dev` the tag reads /src/main.jsx, and a binary built without the
 * frontends serves the tracked placeholder index.html, which has no script tag
 * at all. Callers treat null as "cannot tell", never as "changed".
 */
export function runningEntry(doc = document) {
  const tag = doc.querySelector('script[type="module"][src^="/assets/index-"]');
  // getAttribute, not the .src property: the property resolves to an absolute
  // URL, while the deployed side is only ever a path. Comparing like with like
  // keeps isStale a plain !== rather than a normalisation step that could
  // quietly differ between the two apps.
  return tag?.getAttribute('src') ?? null;
}

/** The entry bundle named by a document's HTML, or null if it names none. */
export function parseEntry(html) {
  if (typeof html !== 'string') return null;
  return ENTRY.exec(html)?.[1] ?? null;
}

/** True when the server is serving a different build than this tab is running. */
export function isStale(running, deployed) {
  // Both guards carry weight. Null on the left is dev or an unbuilt binary;
  // null on the right is an unreadable answer — offline, a 502 mid-rollout, a
  // captive portal serving its own HTML. Neither is evidence of a new build,
  // and treating it as one would nag a merchant to reload for nothing.
  return Boolean(running && deployed && running !== deployed);
}

/**
 * Asks the server which build it is serving. Null on any failure.
 *
 * Every failure path is deliberately silent: a check that could not complete
 * is not news, and the caller must not be able to tell it apart from "no new
 * build" — the two lead to the same do-nothing.
 */
export async function fetchDeployedEntry(fetchImpl = fetch) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    // no-cache rather than no-store: this has to revalidate, but a 304 is a
    // perfectly good answer to it. Forcing a full response would also force
    // the storefront to re-render the document head, which costs several
    // queries per check for a tag that never varies by route or tenant.
    const res = await fetchImpl('/', {
      cache: 'no-cache',
      headers: { Accept: 'text/html' },
      signal: control.signal,
    });
    if (!res.ok) return null;
    return parseEntry(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
