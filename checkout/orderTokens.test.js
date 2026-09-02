import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractToken, forgetOrder, listOrders, rememberOrder } from './orderTokens.js';

const A = 'W6M2SQFRNO73A6G67LTPB7YSOY';
const B = 'B6TL7C6RENCFTV5YEADQEWQ2RI';

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

// This list is the buyer's only copy of a token no endpoint can reissue, so
// what removes an entry matters as much as what writes one.
describe('forgetOrder', () => {
  it('drops one order and leaves the rest', () => {
    rememberOrder({ token: A, number: 'LA-1', total: 159000 });
    rememberOrder({ token: B, number: 'LA-2', total: 83000 });

    expect(forgetOrder(A)).toBe(true);
    expect(listOrders().map((o) => o.token)).toEqual([B]);
  });

  it('is a no-op for a token that is not there, and for no token at all', () => {
    rememberOrder({ token: A, number: 'LA-1', total: 159000 });
    forgetOrder('NOPE');
    expect(forgetOrder('')).toBe(false);
    expect(listOrders()).toHaveLength(1);
  });

  it('leaves a readable envelope behind, so the next write still parses', () => {
    rememberOrder({ token: A, number: 'LA-1', total: 159000 });
    forgetOrder(A);
    expect(listOrders()).toEqual([]);
    rememberOrder({ token: B, number: 'LA-2', total: 83000 });
    expect(listOrders().map((o) => o.token)).toEqual([B]);
  });
});

describe('extractToken', () => {
  it('reads a bare token and a pasted link alike', () => {
    expect(extractToken(A)).toBe(A);
    expect(extractToken(`http://localhost:5173/track/${A}`)).toBe(A);
    expect(extractToken('bukan tautan')).toBeNull();
  });
});
