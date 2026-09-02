import { describe, expect, it } from 'vitest';

import { fmtClock, fmtDate, fmtDateTime, fmtTime, interpolate } from './format.js';

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
});

describe('interpolate', () => {
  it('leaves a placeholder it has no value for', () => {
    expect(interpolate('Gratis di atas {free_shipping_min}', {})).toBe(
      'Gratis di atas {free_shipping_min}',
    );
  });
});
