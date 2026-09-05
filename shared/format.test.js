import { describe, expect, it } from 'vitest';

import fixtures from './shippingCopy.fixtures.json';
import {
  fmt,
  fmtClock,
  fmtDate,
  fmtDateTime,
  fmtTime,
  interpolate,
  paragraphs,
  shippingCopy,
} from './format.js';

// The clock is written by hand rather than by Intl, and the reason is the
// whole test: `id-ID` puts a dot between hours and minutes, so every timestamp
// in both apps read `16.22` — a decimal, not a time.
describe('fmtTime', () => {
  it('separates hours and minutes with a colon', () => {
    expect(fmtTime(new Date(2026, 8, 1, 16, 22))).toBe('16:22');
  });

  it('pads both halves', () => {
    expect(fmtTime(new Date(2026, 8, 1, 9, 5))).toBe('09:05');
  });

  it('writes midnight as 00:00, not 24:00 or 12:00', () => {
    expect(fmtTime(new Date(2026, 8, 1, 0, 0))).toBe('00:00');
  });

  it('is empty for something that is not a date', () => {
    expect(fmtTime('besok pagi')).toBe('');
  });
});

describe('fmtDateTime', () => {
  it('joins a localised date to a colon-separated clock', () => {
    const out = fmtDateTime(new Date(2026, 8, 1, 16, 22).toISOString());
    expect(out).toMatch(/^1 Sep.*, 16:22$/);
    expect(out).not.toContain('16.22');
  });

  it('is empty for a missing or unreadable value', () => {
    expect(fmtDateTime(null)).toBe('');
    expect(fmtDateTime('')).toBe('');
    expect(fmtDateTime('kapan-kapan')).toBe('');
  });
});

describe('fmtDate', () => {
  it('carries no clock at all', () => {
    const out = fmtDate(new Date(2026, 8, 1, 16, 22));
    expect(out).not.toContain(':');
    expect(out).toContain('2026');
  });
});

// Unchanged by this work, and the countdown a buyer watches: mm:ss has always
// used a colon, which is exactly the separator the date formatters lacked.
describe('fmtClock', () => {
  it('counts down in mm:ss', () => {
    expect(fmtClock(65_000)).toBe('1:05');
    expect(fmtClock(-1)).toBe('0:00');
  });

  it('grows an hours field rather than counting to 1439 minutes', () => {
    // A manual payment window is a day. Without the hours term this read
    // "1439:59", which is not a duration anybody can parse.
    expect(fmtClock(24 * 60 * 60_000)).toBe('24:00:00');
    expect(fmtClock(3_600_000 + 65_000)).toBe('1:01:05');
  });

  it('shows no hours field until there are hours', () => {
    // Below an hour every existing caller is unchanged to the character: an
    // OTP window that started reading "0:05:00" would be a change to screens
    // this feature never touched.
    expect(fmtClock(5 * 60_000)).toBe('5:00');
    expect(fmtClock(59 * 60_000 + 59_000)).toBe('59:59');
    // The one place the change is visible on an existing screen: the seeded
    // gateway window is exactly sixty minutes, so its first tick now reads
    // 1:00:00 rather than 60:00. That is the better of the two.
    expect(fmtClock(3_600_000)).toBe('1:00:00');
  });
});

describe('interpolate', () => {
  it('leaves a placeholder it has no value for', () => {
    expect(interpolate('Gratis di atas {free_shipping_min}', {})).toBe(
      'Gratis di atas {free_shipping_min}',
    );
  });
});

// Brand copy that names the threshold is a promise about the checkout, so with
// the offer switched off it is withheld rather than filled in: there is no
// number to substitute, since zero reads as "free for everyone".
describe('shippingCopy', () => {
  const values = { free_shipping_min: 'Rp 150.000' };

  it('substitutes the threshold while free shipping is on', () => {
    expect(shippingCopy('Gratis ongkir di atas {free_shipping_min}.', values, true)).toBe(
      'Gratis ongkir di atas Rp 150.000.',
    );
  });

  it('withholds copy that advertises a threshold once the offer is off', () => {
    expect(shippingCopy('Gratis ongkir di atas {free_shipping_min}.', values, false)).toBe('');
  });

  it('drops only the sentence that promises it, and keeps the rest', () => {
    // The product page says where a parcel ships from, when it leaves, and
    // what makes it free, all in one paragraph. Withholding the paragraph
    // left the "Pengiriman" panel opening onto nothing.
    const para =
      'Dikirim dari Pekalongan via JNE. Pesanan sebelum 15.00 WIB diproses hari itu juga. ' +
      'Gratis ongkir untuk belanja di atas {free_shipping_min}.';
    expect(shippingCopy(para, values, false)).toBe(
      'Dikirim dari Pekalongan via JNE. Pesanan sebelum 15.00 WIB diproses hari itu juga.',
    );
  });

  it('keeps copy that says nothing about shipping, either way', () => {
    const line = 'Dikirim dari Pekalongan via JNE.';
    expect(shippingCopy(line, values, true)).toBe(line);
    expect(shippingCopy(line, values, false)).toBe(line);
  });

  it('is empty for missing copy', () => {
    expect(shippingCopy(undefined, values, false)).toBe('');
    expect(shippingCopy(undefined, values, true)).toBe('');
  });
});

// The about story is one textarea on the merchant's side and several <p>
// elements on the buyer's. This is the whole of that translation, so every way
// a person can press enter has to land somewhere sensible.
describe('paragraphs', () => {
  it('splits on a blank line', () => {
    expect(paragraphs('Satu.\n\nDua.')).toEqual(['Satu.', 'Dua.']);
  });

  it('keeps a single line as one paragraph', () => {
    expect(paragraphs('Satu.')).toEqual(['Satu.']);
  });

  // A single newline is a wrapped line, not a new paragraph. Splitting on it
  // would break every sentence a merchant let wrap in the textarea.
  it('does not split on a single newline', () => {
    expect(paragraphs('Satu.\nmasih satu.')).toEqual(['Satu.\nmasih satu.']);
  });

  it('collapses a run of blank lines into one break', () => {
    expect(paragraphs('Satu.\n\n\n\nDua.')).toEqual(['Satu.', 'Dua.']);
  });

  // A Windows textarea sends \r\n, and without normalising it the \r rides
  // along into the rendered text.
  it('handles CRLF', () => {
    expect(paragraphs('Satu.\r\n\r\nDua.')).toEqual(['Satu.', 'Dua.']);
  });

  it('trims each paragraph and drops empty ones', () => {
    expect(paragraphs('\n\n  Satu.  \n\n   \n\n Dua. \n\n')).toEqual(['Satu.', 'Dua.']);
  });

  // A merchant who has written nothing renders nothing -- not one empty <p>,
  // which would leave a gap the page has no explanation for.
  it('is empty for empty, blank and missing copy', () => {
    expect(paragraphs('')).toEqual([]);
    expect(paragraphs('   \n\n  ')).toEqual([]);
    expect(paragraphs(undefined)).toEqual([]);
    expect(paragraphs(null)).toEqual([]);
  });
});

// The server composes meta tags for crawlers that never run this code, so
// backend/internal/seo/copy.go is a second implementation of the rules above.
// Both sides read this file. A change to either that is not a change to both
// fails here and in backend/internal/seo/copy_test.go, instead of surfacing as
// a WhatsApp preview promising free shipping the checkout refuses.
describe('the shared contract with backend/internal/seo/copy.go', () => {
  it('renders every fixture the way the Go port does', () => {
    for (const tc of fixtures.shippingCopy) {
      expect(shippingCopy(tc.text, fixtures.values, tc.freeShipping), tc.name).toBe(tc.want);
    }
  });

  it('formats rupiah the way the Go port does', () => {
    for (const tc of fixtures.rupiah) {
      expect(fmt(tc.n), `Rupiah(${tc.n})`).toBe(tc.want);
    }
  });
});
