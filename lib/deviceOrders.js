// Presentation rules for the "Pesanan dari perangkat ini" list. No storage, no
// fetching — just how a remembered row and the server's answer about it
// combine into something to render.

/**
 * @typedef {object} DeviceRow
 * @property {string} token
 * @property {string} number       the live number when known, else the remembered one
 * @property {number} total        likewise
 * @property {string} placedAt
 * @property {string} statusLabel  '' until the server has answered
 * @property {'loading'|'ok'|'gone'|'unknown'} state
 */

/**
 * Merges what this device remembers with what the server says about it.
 *
 * The remembered fields are a snapshot from the moment of checkout and are
 * shown while the check is in flight, so the list is never blank and never
 * jumps. Once an answer arrives the server's own numbers win — it is the
 * authority on what an order costs, and a promotion or a cancellation can have
 * moved it since.
 *
 * The states, and why each exists:
 *
 *   loading  no answer yet. Show the remembered row, no status.
 *   ok       the order exists. Show its live status.
 *   gone     404. The order is not there; the row is a dead link and says so.
 *   unknown  any other failure — offline, 5xx, a rate limit. Show the
 *            remembered row unchanged. This is the important one: treating a
 *            network error as `gone` would make a buyer's order history appear
 *            to delete itself the moment their signal dropped.
 *
 * @param {Array<{token: string, number?: string, total?: number, placedAt?: string}>} remembered
 * @param {Array<{data?: any, error?: {status?: number}, isPending?: boolean}>} results
 *   one per remembered order, in the same order
 * @returns {DeviceRow[]}
 */
export function deviceRows(remembered, results) {
  return (remembered ?? []).map((o, i) => {
    const r = results?.[i];
    const order = r?.data?.order;

    if (order) {
      return {
        token: o.token,
        number: order.number ?? o.number,
        total: order.total ?? o.total,
        placedAt: order.placed_at ?? o.placedAt,
        statusLabel: order.status_label ?? '',
        status: order.status ?? '',
        state: 'ok',
      };
    }

    const base = {
      token: o.token,
      number: o.number,
      total: o.total,
      placedAt: o.placedAt,
      statusLabel: '',
      status: '',
    };
    if (r?.error) {
      return { ...base, state: r.error.status === 404 ? 'gone' : 'unknown' };
    }
    return { ...base, state: 'loading' };
  });
}

/** Tokens worth asking about, newest first and never more than the list holds. */
export function tokensOf(remembered) {
  return (remembered ?? []).map((o) => o.token).filter(Boolean);
}
