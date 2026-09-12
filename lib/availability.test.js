import { describe, expect, it } from 'vitest';

import {
  blockerNotice,
  buyLabel,
  closesAt,
  isBlocking,
  isImminent,
  isScheduled,
  msUntilOpen,
  opensAt,
  overlayLabel,
  saleState,
  windowNote,
} from './availability.js';

const NOW = Date.UTC(2026, 8, 5, 12, 0, 0);
const iso = (ms) => new Date(ms).toISOString();

const scheduled = (openIn) => ({
  availability: 'scheduled',
  sell_from: iso(NOW + openIn),
});

describe('saleState', () => {
  it('takes the server at its word', () => {
    expect(saleState({ availability: 'ended' })).toBe('ended');
  });

  // An API older than this feature sends no such field, and the storefront has
  // to keep selling: the stock rules downstream are unchanged.
  it('treats a missing field as available', () => {
    expect(saleState({ stock: 3 })).toBe('available');
    expect(saleState(undefined)).toBe('available');
  });
});

describe('opensAt', () => {
  it('reads the opening of a scheduled product', () => {
    expect(opensAt(scheduled(3600_000))?.getTime()).toBe(NOW + 3600_000);
  });

  // A past opening is not news. Every caller is asking "is there a date to
  // show", not "was there ever one".
  it('is null once the product is open', () => {
    expect(opensAt({ availability: 'available', sell_from: iso(NOW - 1) })).toBeNull();
  });

  it('is null for a product with no schedule', () => {
    expect(opensAt({ availability: 'scheduled' })).toBeNull();
  });

  it('survives a timestamp it cannot parse', () => {
    expect(opensAt({ availability: 'scheduled', sell_from: 'segera' })).toBeNull();
  });
});

describe('closesAt', () => {
  it('reads the closing whatever the state', () => {
    expect(closesAt({ sell_until: iso(NOW + 60_000) })?.getTime()).toBe(NOW + 60_000);
  });

  it('is null when the sale never closes', () => {
    expect(closesAt({ availability: 'available' })).toBeNull();
  });
});

describe('overlayLabel', () => {
  it('says when a drop opens', () => {
    const got = overlayLabel(scheduled(3600_000));
    expect(got.title).toBe('SEGERA');
    expect(got.detail).toBeTruthy();
  });

  it('separates a closed sale from an empty shelf', () => {
    expect(overlayLabel({ availability: 'ended' }).title).toBe('SUDAH DITUTUP');
    expect(overlayLabel({ availability: 'sold_out' }).title).toBe('HABIS');
  });

  it('is null for anything the buyer can act on', () => {
    expect(overlayLabel({ availability: 'available' })).toBeNull();
  });
});

describe('windowNote', () => {
  it('names the opening of a scheduled product', () => {
    expect(windowNote(scheduled(3600_000)).text).toMatch(/^Dibuka /);
  });

  it('falls back to a bare sentence when the date is unreadable', () => {
    expect(windowNote({ availability: 'scheduled' }).text).toBe('Belum dibuka');
  });

  it('states a closing while it can still be acted on', () => {
    const note = windowNote({ availability: 'available', sell_until: iso(NOW + 3600_000) });
    expect(note.text).toMatch(/^Berlaku sampai /);
  });

  // Most products never close, and a note on every card would be noise.
  it('says nothing about a product with no window', () => {
    expect(windowNote({ availability: 'available' })).toBeNull();
  });
});

describe('buyLabel', () => {
  it('gives the button the server’s reason', () => {
    expect(buyLabel(scheduled(3600_000))).toMatch(/^Dibuka /);
    expect(buyLabel({ availability: 'ended' })).toBe('Penjualan ditutup');
    expect(buyLabel({ availability: 'sold_out' })).toBe('Stok habis');
  });

  it('is null while the product can be bought', () => {
    expect(buyLabel({ availability: 'available' })).toBeNull();
  });
});

describe('the countdown', () => {
  it('counts down to the opening', () => {
    expect(msUntilOpen(scheduled(90_000), NOW)).toBe(90_000);
  });

  // Never negative on screen. Zero is the signal to ask the server, not to
  // start counting up.
  it('floors at zero once the moment has passed', () => {
    expect(msUntilOpen(scheduled(-5_000), NOW)).toBe(0);
  });

  it('is null when there is nothing to wait for', () => {
    expect(msUntilOpen({ availability: 'available' }, NOW)).toBeNull();
  });

  // A drop three weeks out gets a date, not a ticking clock.
  it('only ticks for an opening within twelve hours', () => {
    expect(isImminent(scheduled(60 * 60 * 1000), NOW)).toBe(true);
    expect(isImminent(scheduled(13 * 60 * 60 * 1000), NOW)).toBe(false);
    expect(isImminent({ availability: 'available' }, NOW)).toBe(false);
  });
});

describe('blockers', () => {
  it('names every status the draft would refuse', () => {
    for (const s of ['gone', 'soldout', 'scheduled', 'ended', 'variant_required']) {
      expect(isBlocking(s)).toBe(true);
    }
    for (const s of ['ok', 'overstock', 'loading', 'error']) {
      expect(isBlocking(s)).toBe(false);
    }
  });

  it('says nothing when the cart is fine', () => {
    expect(blockerNotice(['ok', 'overstock'])).toBeNull();
    expect(blockerNotice([])).toBeNull();
    expect(blockerNotice(undefined)).toBeNull();
  });

  // The two notices ask for opposite actions, which is the whole reason there
  // are two: a drop that has not opened is worth keeping in the cart.
  it('tells a waiting buyer to keep the line', () => {
    expect(blockerNotice(['ok', 'scheduled'])).toMatch(/Simpan di keranjang/);
  });

  it('tells a buyer with a dead line to remove it', () => {
    expect(blockerNotice(['scheduled', 'soldout'])).toMatch(/Hapus dulu/);
    expect(blockerNotice(['gone'])).toMatch(/Hapus dulu/);
  });

  // A line that only lacks a variant is a sale worth keeping: ask for the
  // choice, not the deletion.
  it('tells a buyer to pick a variant when that is all that blocks', () => {
    expect(blockerNotice(['ok', 'variant_required'])).toMatch(/pilih varian/);
    expect(blockerNotice(['variant_required', 'soldout'])).toMatch(/Hapus dulu/);
  });
});

describe('isScheduled', () => {
  it('is the one state that is not permanent', () => {
    expect(isScheduled(scheduled(1))).toBe(true);
    expect(isScheduled({ availability: 'ended' })).toBe(false);
  });
});
