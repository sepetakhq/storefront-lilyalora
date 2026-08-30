import { describe, expect, it } from 'vitest';

import { isQrImageURL, isQrisPayload, isUsableRedirect } from './payment.js';

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

  it("rejects Sakurupiah's image URLs, which arrive in the payload field", () => {
    // The sandbox serves one sample image for every transaction; production
    // serves a real per-transaction one. Both are URLs, and neither can be
    // encoded. The backend now routes them to qr_image before they get here.
    expect(
      isQrisPayload('https://sakurupiah.id/assets/img/sakurupiah-sanbox-sampleQR.png'),
    ).toBe(false);
    expect(
      isQrisPayload('https://sakurupiah.id/qr-codeIMG/TRX1788086870-PDC3yb2gKMT.png'),
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

// A provider that draws its own QR hands over a URL, and the two validators
// must never accept each other's input: a payload in an <img> renders nothing,
// and a URL in the encoder renders a code that opens a web page.
describe('isQrImageURL', () => {
  const drawn = 'https://api.sandbox.midtrans.com/v2/qris/0d8178e1-a2b3-4c5d/qr-code';

  // The two providers that draw their own QR. Sakurupiah's is per transaction
  // in production, unlike the single sample image its sandbox serves.
  const sakurupiah = 'https://sakurupiah.id/qr-codeIMG/TRX1788086870-PDC3yb2gKMT.png';

  it("accepts a provider's rendered QR", () => {
    expect(isQrImageURL(drawn)).toBe(true);
    expect(isQrImageURL(sakurupiah)).toBe(true);
  });

  it('rejects an uppercase scheme, which the backend rejects too', () => {
    // The Go classifier compares case-sensitively; accepting it on one side
    // only is how a value gets stored that the other side will not render.
    expect(isQrImageURL('HTTPS://sakurupiah.id/qr.png')).toBe(false);
  });

  it('rejects the same URL over http, which the browser drops as mixed content', () => {
    expect(isQrImageURL(drawn.replace('https://', 'http://'))).toBe(false);
  });

  it('rejects a relative path, which leads nowhere', () => {
    expect(isQrImageURL('/dev/pay/stub_LA2608270001')).toBe(false);
  });

  it('rejects an empty or missing URL', () => {
    for (const v of ['', undefined, null, 0, {}]) {
      expect(isQrImageURL(v)).toBe(false);
    }
  });

  it('does not accept an EMVCo payload, which belongs to the encoder', () => {
    expect(isQrImageURL('000201010212266700160COM.NOBUBANK.WWW')).toBe(false);
  });

  it('is not accepted by isQrisPayload either, so the two can never be confused', () => {
    expect(isQrisPayload(drawn)).toBe(false);
  });
});
