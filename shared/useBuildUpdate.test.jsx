import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBuildUpdate } from './useBuildUpdate.js';

// Testing Library only registers its own cleanup when vitest runs with globals,
// which this project does not.
afterEach(cleanup);

const RUNNING = '/assets/index-running.js';

function documentFor(entry) {
  return `<html><head><script type="module" crossorigin src="${entry}"></script></head></html>`;
}

/** Puts an entry tag in this document, so the hook believes it is a real build. */
function bootAs(entry) {
  const tag = document.createElement('script');
  tag.type = 'module';
  tag.src = entry;
  document.head.appendChild(tag);
  return tag;
}

describe('useBuildUpdate', () => {
  let realFetch;
  let clock;
  let served;
  let calls;
  let tag;

  beforeEach(() => {
    clock = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    realFetch = global.fetch;
    calls = 0;
    served = RUNNING;
    global.fetch = vi.fn(async () => {
      calls += 1;
      return { ok: true, text: async () => documentFor(served) };
    });
    tag = bootAs(RUNNING);
  });

  afterEach(() => {
    global.fetch = realFetch;
    tag?.remove();
    vi.restoreAllMocks();
  });

  /** One tab refocus, with the resulting check flushed. */
  async function refocus() {
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  it('says nothing while the server is serving the same build', async () => {
    const { result } = renderHook(() => useBuildUpdate());
    await refocus();
    expect(result.current.updateReady).toBe(false);
  });

  it('does not check before the tab is ever refocused', () => {
    renderHook(() => useBuildUpdate());
    expect(calls).toBe(0);
  });

  it('raises the banner once a different build is deployed', async () => {
    const { result } = renderHook(() => useBuildUpdate());
    served = '/assets/index-deployed.js';
    await refocus();
    expect(result.current.updateReady).toBe(true);
  });

  it('collapses a second refocus inside the throttle window', async () => {
    renderHook(() => useBuildUpdate());
    await refocus();
    clock += 30_000;
    await refocus();
    expect(calls).toBe(1);
  });

  it('checks again once the window has passed', async () => {
    renderHook(() => useBuildUpdate());
    await refocus();
    clock += 61_000;
    await refocus();
    expect(calls).toBe(2);
  });

  it('keeps a known update visible when a later check fails', async () => {
    // Once we know a new build exists, a network blip is no reason to take the
    // banner away -- the tab is still stale.
    const { result } = renderHook(() => useBuildUpdate());
    served = '/assets/index-deployed.js';
    await refocus();
    global.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    clock += 61_000;
    await refocus();
    expect(result.current.updateReady).toBe(true);
  });

  it('stays quiet after a dismissal', async () => {
    const { result } = renderHook(() => useBuildUpdate());
    served = '/assets/index-deployed.js';
    await refocus();
    act(() => result.current.dismiss());
    expect(result.current.updateReady).toBe(false);
  });

  it('asks again when a further build ships after a dismissal', async () => {
    // The dismissal remembers which build was waved away, not merely that one
    // was. A boolean here would silence the tab for the rest of its life.
    const { result } = renderHook(() => useBuildUpdate());
    served = '/assets/index-second.js';
    await refocus();
    act(() => result.current.dismiss());
    expect(result.current.updateReady).toBe(false);

    served = '/assets/index-third.js';
    clock += 61_000;
    await refocus();
    expect(result.current.updateReady).toBe(true);
  });

  it('is inert when there is no hashed entry to compare', async () => {
    // The dev server and a binary built without the frontends both land here.
    tag.remove();
    tag = null;
    const { result } = renderHook(() => useBuildUpdate());
    await refocus();
    expect(calls).toBe(0);
    expect(result.current.updateReady).toBe(false);
  });

  it('ignores the visibilitychange that fires on the way out', async () => {
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    renderHook(() => useBuildUpdate());
    await refocus();
    expect(calls).toBe(0);
    hidden.mockRestore();
  });

  it('stops checking once unmounted', async () => {
    const { unmount } = renderHook(() => useBuildUpdate());
    unmount();
    await refocus();
    expect(calls).toBe(0);
  });
});
