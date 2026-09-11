import { describe, expect, it } from 'vitest';

import {
  availableQty,
  cartLineStatus,
  countsStock,
  isSoldOut,
  leadDays,
  maxQty,
  orderNote,
  shortNote,
  stockNote,
} from './preorder.js';

const made = (over = {}) => ({ preorder: true, preorder_lead_days: 10, stock: 0, sold_out: false, ...over });
const stocked = (over = {}) => ({ preorder: false, preorder_lead_days: 0, stock: 5, sold_out: false, ...over });
const unlimited = (over = {}) => ({ preorder: false, unlimited_stock: true, stock: 0, sold_out: false, ...over });

describe('maxQty', () => {
  it('caps a pre-order at the server limit, not at its stock', () => {
    // The bug this guards: stock 0 pinned the stepper to exactly 1, so a
    // made-to-order product could only ever be bought one at a time.
    expect(maxQty(made())).toBe(99);
  });

  it('still caps an ordinary product at its stock', () => {
    expect(maxQty(stocked({ stock: 3 }))).toBe(3);
    expect(maxQty(stocked({ stock: 500 }))).toBe(99);
  });

  it('never returns less than one, so the stepper stays usable', () => {
    expect(maxQty(stocked({ stock: 0 }))).toBe(1);
  });
});

describe('availableQty', () => {
  it('reports the server limit for a pre-order', () => {
    // What the cart's + button is gated on; the old value was the stock
    // number, which left the button dead on every pre-order line.
    expect(availableQty(made())).toBe(99);
  });

  it('reports real stock for an ordinary product', () => {
    expect(availableQty(stocked({ stock: 4 }))).toBe(4);
  });
});

describe('isSoldOut', () => {
  it('trusts the server for a pre-order at zero stock', () => {
    expect(isSoldOut(made())).toBe(false);
  });

  it('still blocks an ordinary product the server called sold out', () => {
    expect(isSoldOut(stocked({ stock: 0, sold_out: true }))).toBe(true);
  });
});

describe('leadDays', () => {
  it('is zero for an ordinary product whatever the field says', () => {
    expect(leadDays(stocked({ preorder_lead_days: 30 }))).toBe(0);
  });

  it('is zero when the shop never stated a wait', () => {
    // A real answer, not a missing one: sold as made-to-order, no date given.
    expect(leadDays(made({ preorder_lead_days: 0 }))).toBe(0);
  });

  it('is the resolved number the server sent', () => {
    expect(leadDays(made({ preorder_lead_days: 21 }))).toBe(21);
  });
});

describe('stockNote', () => {
  it('never tells a buyer a pre-order is out of stock', () => {
    expect(stockNote(made()).text).toContain('Pre-order');
    expect(stockNote(made()).text).toContain('±10 hari');
  });

  it('omits the wait when the shop never stated one', () => {
    expect(stockNote(made({ preorder_lead_days: 0 })).text).not.toContain('±');
  });

  it('never quotes a stock count for a pre-order', () => {
    expect(stockNote(made({ stock: 42 })).text).not.toContain('42');
  });

  it('leaves the ordinary ladder alone', () => {
    expect(stockNote(stocked({ stock: 0 })).text).toContain('Stok habis');
    expect(stockNote(stocked({ stock: 3 })).text).toContain('Sisa 3');
    expect(stockNote(stocked({ stock: 20 })).text).toContain('20 pcs');
  });
});

describe('shortNote and orderNote', () => {
  it('says nothing for an ordinary product', () => {
    expect(shortNote(stocked())).toBeNull();
    expect(orderNote(0)).toBeNull();
  });

  it('quotes one wait for the whole order', () => {
    expect(orderNote(21)).toContain('±21 hari');
  });
});

describe('cartLineStatus', () => {
  const item = { qty: 2 };

  it('passes a pre-order line at zero stock', () => {
    expect(cartLineStatus(item, made(), {})).toBe('ok');
  });

  it('does not call a pre-order line overstock', () => {
    // The named bug: qty 2 against stock 0 read as "more than we have",
    // which blocked checkout on a product that has no stock to exceed.
    expect(cartLineStatus({ qty: 5 }, made({ stock: 0 }), {})).toBe('ok');
  });

  it('still blocks an ordinary sold-out line', () => {
    expect(cartLineStatus(item, stocked({ stock: 0, sold_out: true }), {})).toBe('soldout');
  });

  it('still flags an ordinary overstock line', () => {
    expect(cartLineStatus({ qty: 9 }, stocked({ stock: 4 }), {})).toBe('overstock');
  });

  it('reports a deleted product as gone before anything else', () => {
    expect(cartLineStatus(item, null, { error: { status: 404 } })).toBe('gone');
  });

  it('reports loading first of all', () => {
    expect(cartLineStatus(item, null, { isPending: true })).toBe('loading');
  });

  // Both window rungs sit above the pre-order exemption, mirroring the
  // server's precedence: a made-to-order drop that has not opened cannot be
  // bought either, and a line reported 'ok' here is a line checkout refuses.
  it('blocks a line whose sale has not opened', () => {
    expect(cartLineStatus(item, stocked({ availability: 'scheduled' }), {})).toBe('scheduled');
    expect(cartLineStatus(item, made({ availability: 'scheduled' }), {})).toBe('scheduled');
  });

  it('blocks a line whose sale has closed', () => {
    expect(cartLineStatus(item, stocked({ availability: 'ended', sold_out: true }), {})).toBe('ended');
    expect(cartLineStatus(item, made({ availability: 'ended' }), {})).toBe('ended');
  });

  // A scheduled line is not sold out, however empty the shelf: the merchant
  // has until the opening to make some.
  it('prefers the window reason over an empty shelf', () => {
    expect(cartLineStatus(item, stocked({ stock: 0, availability: 'scheduled' }), {})).toBe(
      'scheduled',
    );
  });

  it('leaves an ordinary line alone', () => {
    expect(cartLineStatus(item, stocked({ availability: 'available' }), {})).toBe('ok');
  });
});

// Unlimited stock is a pre-order minus the promise: bought at any stock
// number, but with no note, no lead time and no badge.
describe('unlimited stock', () => {
  it('is not counted, like a pre-order', () => {
    expect(countsStock(unlimited())).toBe(false);
    expect(countsStock(made())).toBe(false);
    expect(countsStock(stocked())).toBe(true);
    expect(countsStock(undefined)).toBe(true);
  });

  it('caps at the server limit, not at its stock', () => {
    expect(maxQty(unlimited({ stock: 0 }))).toBe(99);
    expect(availableQty(unlimited({ stock: 0 }))).toBe(99);
  });

  it('shows no stock note at all', () => {
    expect(stockNote(unlimited({ stock: 0 }))).toBeNull();
    expect(stockNote(unlimited({ stock: 42 }))).toBeNull();
    expect(shortNote(unlimited())).toBeNull();
    expect(leadDays(unlimited({ preorder_lead_days: 30 }))).toBe(0);
  });

  it('passes a cart line at zero stock and never calls it overstock', () => {
    expect(cartLineStatus({ qty: 5 }, unlimited({ stock: 0 }), {})).toBe('ok');
  });

  it('still honours the sale window', () => {
    expect(cartLineStatus({ qty: 1 }, unlimited({ availability: 'scheduled' }), {})).toBe('scheduled');
    expect(cartLineStatus({ qty: 1 }, unlimited({ availability: 'ended', sold_out: true }), {})).toBe('ended');
  });
});
