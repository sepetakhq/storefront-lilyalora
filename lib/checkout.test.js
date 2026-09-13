import { describe, expect, it } from 'vitest';

import { storeNotReady } from './checkout.js';

describe('storeNotReady', () => {
  it('names both gaps for a shop straight out of signup', () => {
    expect(storeNotReady({ couriers: [], paymentMethods: [], liveShipping: false })).toEqual({
      shipping: true,
      payment: true,
    });
  });

  it('is quiet once the shop can take an order', () => {
    expect(
      storeNotReady({ couriers: [{ code: 'jne' }], paymentMethods: [{ code: 'QRIS' }], liveShipping: false }),
    ).toEqual({ shipping: false, payment: false });
  });

  it('leaves shipping to the rates panel under live mode', () => {
    expect(storeNotReady({ couriers: [], paymentMethods: [{ code: 'QRIS' }], liveShipping: true })).toEqual({
      shipping: false,
      payment: false,
    });
  });

  it('tolerates a config that has not arrived', () => {
    expect(storeNotReady({})).toEqual({ shipping: true, payment: true });
  });
});
