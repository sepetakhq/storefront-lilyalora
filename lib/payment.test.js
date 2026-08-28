import { describe, expect, it } from 'vitest';

import { isQrisPayload, isUsableRedirect } from './payment.js';

// Encoding a non-payload produces a QR that scans perfectly and does the wrong
// thing, which is worse for a buyer than showing no code at all. Every value
// below except the first is one a gateway has actually returned.
describe('isQrisPayload', () => {
  // Shape of a real EMVCo payload: format indicator, merchant account
  // information, merchant name, then the CRC.
  const real =
    '00020101021226670016COM.NOBUBANK.WWW01189360050300000898240214' +
    '1234567890123450303UMI51440014ID.CO.QRIS.WWW0215ID10261234567890303UMI' +
    '5204541153033605802ID5910LILY ALORA6010PEKALONGAN61055111162070703A016304ABCD';

  it('accepts a real payload', () => {
    expect(isQrisPayload(real)).toBe(true);
  });

  it("rejects Sakurupiah's sandbox placeholder image URL", () => {
    // Returned in the `qr` field, identical for every transaction.
    expect(
      isQrisPayload('https://sakurupiah.id/assets/img/sakurupiah-sanbox-sampleQR.png'),
    ).toBe(false);
  });

  it('rejects the stub gateway payload', () => {
    expect(isQrisPayload('STUB-QRIS|LA-260827-0001|75000')).toBe(false);
  });

  it('rejects a value that opens correctly but is too short to be one', () => {
    // Guards against a truncated payload encoding into a scannable but
    // meaningless code.
    expect(isQrisPayload('000201021126')).toBe(false);
  });

  it('rejects anything that is not a string', () => {
    for (const v of [undefined, null, 0, {}, [], true]) {
      expect(isQrisPayload(v)).toBe(false);
    }
  });
});

describe('isUsableRedirect', () => {
  it("accepts a provider's checkout URL", () => {
    expect(isUsableRedirect('https://sakurupiah.id/checkout/abc123')).toBe(true);
  });

  it('rejects the stub gateway redirect, which has no route behind it', () => {
    expect(isUsableRedirect('/dev/pay/stub_LA2608270001')).toBe(false);
  });

  it('rejects an empty or missing URL', () => {
    for (const v of ['', undefined, null]) {
      expect(isUsableRedirect(v)).toBe(false);
    }
  });
});
