import { describe, expect, it } from 'vitest';

import { deviceRows, tokensOf } from './deviceOrders.js';

const remembered = [
  { token: 'AAA', number: 'LA-1', total: 159000, placedAt: '2026-09-02T12:48:05Z' },
  { token: 'BBB', number: 'LA-2', total: 75000, placedAt: '2026-08-30T12:00:00Z' },
];

const answered = (order) => ({ data: { order } });
const failed = (status) => ({ error: { status } });
const pending = () => ({ isPending: true });

describe('deviceRows', () => {
  // The remembered row is a snapshot from checkout. Showing it while the check
  // is in flight is what keeps the list from being blank on first paint.
  it('shows what the device remembers until the server answers', () => {
    const [row] = deviceRows(remembered, [pending(), pending()]);
    expect(row).toMatchObject({ number: 'LA-1', total: 159000, state: 'loading', statusLabel: '' });
  });

  // The list used to render frozen values forever, so fourteen expired orders
  // looked exactly like a live one.
  it('prefers the server once it answers, and carries the status', () => {
    const [row] = deviceRows(remembered, [
      answered({ number: 'LA-1', total: 134000, status: 'shipped', status_label: 'Dikirim' }),
      pending(),
    ]);
    expect(row).toMatchObject({ total: 134000, status: 'shipped', statusLabel: 'Dikirim', state: 'ok' });
  });

  // Two rows both read LA-260829-0001 on a real device; one token 404s.
  it('marks a 404 as gone', () => {
    const [, row] = deviceRows(remembered, [pending(), failed(404)]);
    expect(row.state).toBe('gone');
    expect(row.number).toBe('LA-2');
  });

  // The one that matters: an offline buyer must not watch their order history
  // appear to delete itself.
  it('leaves a row alone on any failure that is not a 404', () => {
    for (const status of [0, undefined, 429, 500, 503]) {
      const [row] = deviceRows(remembered, [failed(status), pending()]);
      expect(row.state).toBe('unknown');
      expect(row.number).toBe('LA-1');
      expect(row.total).toBe(159000);
    }
  });

  it('survives a results array that is short or missing', () => {
    expect(deviceRows(remembered, []).map((r) => r.state)).toEqual(['loading', 'loading']);
    expect(deviceRows(remembered, undefined)).toHaveLength(2);
    expect(deviceRows(undefined, [])).toEqual([]);
  });
});

describe('tokensOf', () => {
  it('keeps order and drops anything empty', () => {
    expect(tokensOf([{ token: 'AAA' }, { token: '' }, { token: 'BBB' }])).toEqual(['AAA', 'BBB']);
    expect(tokensOf(undefined)).toEqual([]);
  });
});
