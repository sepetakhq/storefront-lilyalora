import { describe, expect, it } from 'vitest';

import fixtures from './voucherCode.fixtures.json';
import { MAX_CODE_LEN, MIN_CODE_LEN, normalizeVoucherCode } from './voucher.js';

// The fixture is the contract with promo.NormalizeCode, read by
// backend/internal/promo/voucher_test.go as well. A case that only passes here
// is a case where the merchant's field and the buyer's field disagree.
describe('normalizeVoucherCode', () => {
  for (const c of fixtures.cases) {
    it(c.why, () => {
      expect(normalizeVoucherCode(c.raw)).toBe(c.normalized);
    });
  }

  it('is empty for nullish input rather than "UNDEFINED"', () => {
    expect(normalizeVoucherCode(undefined)).toBe('');
    expect(normalizeVoucherCode(null)).toBe('');
  });

  // The order the two steps run in is the bug this module was extracted to
  // fix: uppercasing first turns "ﬁ" into "FI", which the filter then keeps.
  it('drops characters that would case-fold into the alphabet', () => {
    expect(normalizeVoucherCode('ﬁ')).toBe('');
    expect(normalizeVoucherCode('ı')).toBe('');
  });
});

describe('code length bounds', () => {
  it('matches the server', () => {
    expect(MIN_CODE_LEN).toBe(4);
    expect(MAX_CODE_LEN).toBe(32);
  });
});
