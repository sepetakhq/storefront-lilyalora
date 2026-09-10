import { describe, expect, it } from 'vitest';

import { fetchDeployedEntry, isStale, parseEntry, runningEntry } from './buildVersion.js';

// The shapes actually emitted, copied from dist/index.html and
// dist-admin/index.html. They differ in indentation, and `crossorigin` sits
// before `src` in both -- the two things a naive regex gets wrong.
const BUILT_STOREFRONT = `<!DOCTYPE html><html><head>
<!--seo:start--><title>Toko</title><!--seo:end-->
  <script type="module" crossorigin src="/assets/index-DkqrgwCD.js"></script>
  <link rel="stylesheet" crossorigin href="/assets/index-YXjOUuOK.css">
</head><body><div id="root"></div></body></html>`;

const BUILT_ADMIN = `<!doctype html><html><head>
    <script type="module" crossorigin src="/assets/index-DkPus84Z.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-vxx3Hj0u.css">
  </head><body><div id="root"></div></body></html>`;

// What Vite's dev server serves, and what a binary built without the frontends
// serves (backend/internal/webui/*/index.html is a tracked placeholder).
const DEV = `<html><head></head><body><div id="root"></div>
<script type="module" src="/src/main.jsx"></script></body></html>`;

const PLACEHOLDER = `<html><body><div id="root"></div></body></html>`;

function docOf(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function response({ ok = true, body = '' } = {}) {
  return { ok, text: async () => body };
}

describe('runningEntry', () => {
  it('reads the hashed entry out of a built document', () => {
    expect(runningEntry(docOf(BUILT_STOREFRONT))).toBe('/assets/index-DkqrgwCD.js');
    expect(runningEntry(docOf(BUILT_ADMIN))).toBe('/assets/index-DkPus84Z.js');
  });

  it('returns a path, not the resolved absolute URL', () => {
    // The .src property would answer "http://localhost/assets/...", which would
    // never equal the path parsed out of the server's HTML.
    expect(runningEntry(docOf(BUILT_STOREFRONT)).startsWith('/')).toBe(true);
  });

  it('is null under the dev server, where the entry is source', () => {
    expect(runningEntry(docOf(DEV))).toBeNull();
  });

  it('is null for a binary serving the placeholder index.html', () => {
    expect(runningEntry(docOf(PLACEHOLDER))).toBeNull();
  });
});

describe('parseEntry', () => {
  it('finds the entry in either app, whatever the indentation', () => {
    expect(parseEntry(BUILT_STOREFRONT)).toBe('/assets/index-DkqrgwCD.js');
    expect(parseEntry(BUILT_ADMIN)).toBe('/assets/index-DkPus84Z.js');
  });

  it('does not mistake the stylesheet for the entry', () => {
    // Same /assets/index- prefix, but href on a <link>. Matching it would
    // compare a CSS hash against a JS one and report a permanent update.
    expect(parseEntry('<link rel="stylesheet" href="/assets/index-YXjOUuOK.css">')).toBeNull();
  });

  it('does not match a script that only mentions the path in its body', () => {
    expect(parseEntry('<script type="application/ld+json">{"u":"/assets/index-x.js"}</script>')).toBeNull();
  });

  it('is null for dev HTML, empty input and non-HTML', () => {
    expect(parseEntry(DEV)).toBeNull();
    expect(parseEntry('')).toBeNull();
    expect(parseEntry('login required')).toBeNull();
    expect(parseEntry(null)).toBeNull();
    expect(parseEntry(undefined)).toBeNull();
  });
});

describe('isStale', () => {
  it('is true only when both sides are known and they differ', () => {
    expect(isStale('/assets/index-a.js', '/assets/index-b.js')).toBe(true);
    expect(isStale('/assets/index-a.js', '/assets/index-a.js')).toBe(false);
  });

  it('is false whenever either side is unknown', () => {
    // Dev and unbuilt binaries make the left side null; offline, a 502
    // mid-rollout and a captive portal make the right side null. None of them
    // is a deploy, and nagging a merchant on a failed check is worse than
    // missing one.
    expect(isStale(null, '/assets/index-b.js')).toBe(false);
    expect(isStale('/assets/index-a.js', null)).toBe(false);
    expect(isStale(null, null)).toBe(false);
  });

  it('reports a rollback as stale, because it is', () => {
    // The hash goes backwards, but this tab still does not match the server.
    expect(isStale('/assets/index-new.js', '/assets/index-old.js')).toBe(true);
  });
});

describe('fetchDeployedEntry', () => {
  it('returns the entry the server is serving', async () => {
    const got = await fetchDeployedEntry(async () => response({ body: BUILT_STOREFRONT }));
    expect(got).toBe('/assets/index-DkqrgwCD.js');
  });

  it('revalidates rather than bypassing the cache entirely', async () => {
    // no-store would force the storefront to re-render the document head --
    // several queries -- for a tag that never varies.
    let init;
    await fetchDeployedEntry(async (_url, opts) => {
      init = opts;
      return response({ body: BUILT_STOREFRONT });
    });
    expect(init.cache).toBe('no-cache');
  });

  it('asks for the document root', async () => {
    let url;
    await fetchDeployedEntry(async (u) => {
      url = u;
      return response({ body: BUILT_STOREFRONT });
    });
    expect(url).toBe('/');
  });

  it('is null on a non-ok response', async () => {
    expect(await fetchDeployedEntry(async () => response({ ok: false }))).toBeNull();
  });

  it('is null when the request throws', async () => {
    expect(
      await fetchDeployedEntry(async () => {
        throw new TypeError('Failed to fetch');
      }),
    ).toBeNull();
  });

  it('is null when the answer is not the app', async () => {
    expect(await fetchDeployedEntry(async () => response({ body: '<html>captive portal</html>' }))).toBeNull();
  });
});
