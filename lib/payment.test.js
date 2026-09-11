import { describe, expect, it } from 'vitest';

import {
  PAY_DEAD,
  PAY_LIVE,
  PAY_SETTLED,
  canClaimPayment,
  canRetryPayment,
  isDisplayableImageURL,
  isManualPayment,
  isQrImageURL,
  isQrisPayload,
  isUsableRedirect,
  splitUniqueCode,
  paymentState,
} from './payment.js';

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

describe('paymentState', () => {
  it('reads no payment at all as dead', () => {
    // openIntent returns nothing when the very first charge failed, so this is
    // what checkout hands the order page.
    expect(paymentState(null)).toBe(PAY_DEAD);
    expect(paymentState(undefined)).toBe(PAY_DEAD);
  });

  it('reads a failed intent as dead', () => {
    // The production shape: LA-260903-0001.
    expect(paymentState({ status: 'failed', kind: '', amount: 200 })).toBe(PAY_DEAD);
  });

  it('reads an expired intent as dead', () => {
    expect(paymentState({ status: 'expired', kind: 'qr' })).toBe(PAY_DEAD);
  });

  it('reads a pending intent with no payload as dead', () => {
    // The row exists but the gateway filled nothing. Indistinguishable to a
    // buyer from a failure, and treated as one.
    expect(paymentState({ status: 'pending', kind: '' })).toBe(PAY_DEAD);
  });

  it('reads a pending intent carrying instructions as live', () => {
    expect(paymentState({ status: 'pending', kind: 'qr_image' })).toBe(PAY_LIVE);
    expect(paymentState({ status: 'pending', kind: 'va' })).toBe(PAY_LIVE);
  });

  it('reads money that has arrived as settled', () => {
    for (const status of ['paid', 'settled', 'refunded']) {
      expect(paymentState({ status, kind: 'qr' })).toBe(PAY_SETTLED);
    }
  });

  it('does not blank a renderable payload on a status it has never seen', () => {
    // A future gateway can teach the API a status this file predates. Falling
    // through to the payload is the safe direction.
    expect(paymentState({ status: 'chargeback_pending', kind: 'va' })).toBe(PAY_LIVE);
  });
});

describe('canRetryPayment', () => {
  const dead = { status: 'failed', kind: '' };

  it('offers a retry on a live order with a dead intent', () => {
    expect(canRetryPayment({ status: 'awaiting_payment' }, dead)).toBe(true);
    expect(canRetryPayment({ status: 'awaiting_payment' }, null)).toBe(true);
  });

  it('offers nothing once the order has moved on', () => {
    // Order status beats payment status. The server refuses these, so a button
    // here would only ever produce an error.
    for (const status of ['processing', 'shipped', 'completed', 'cancelled', 'expired']) {
      expect(canRetryPayment({ status }, dead)).toBe(false);
    }
  });

  it('offers nothing when the buyer already has instructions', () => {
    expect(canRetryPayment({ status: 'awaiting_payment' }, { status: 'pending', kind: 'qr' })).toBe(
      false,
    );
  });
});

// The three digits that tie a bank credit to an order.
describe('splitUniqueCode', () => {
  it('separates the code from the price so it can be marked in place', () => {
    expect(splitUniqueCode('Rp 79.137', 137)).toEqual({ head: 'Rp 79.', code: '137' });
  });

  it('says nothing about a gateway amount', () => {
    // Zero is what every gateway order carries, and marking three arbitrary
    // digits of an ordinary total would invent a meaning that is not there.
    expect(splitUniqueCode('Rp 79.000', 0)).toBeNull();
    expect(splitUniqueCode('Rp 79.000', undefined)).toBeNull();
  });

  it('refuses a code the amount does not end in', () => {
    // A mismatch means the two came from different orders -- a stale render,
    // or a cache patched with half an update. Marking the wrong digits would
    // be worse than marking none, because the buyer would transfer them.
    expect(splitUniqueCode('Rp 79.000', 137)).toBeNull();
    // And a code that is not three digits is not a code this system issued.
    expect(splitUniqueCode('Rp 79.13', 13)).toBeNull();
  });
});

describe('isManualPayment', () => {
  it('recognises both rails a shop can be paid on directly', () => {
    expect(isManualPayment({ kind: 'manual_transfer' })).toBe(true);
    expect(isManualPayment({ kind: 'manual_qris' })).toBe(true);
    expect(isManualPayment({ kind: 'manual_whatsapp' })).toBe(true);
  });

  it('is false for every gateway kind, and for nothing at all', () => {
    for (const kind of ['qr', 'qr_image', 'va', 'redirect', '', undefined]) {
      expect(isManualPayment({ kind })).toBe(false);
    }
    expect(isManualPayment(null)).toBe(false);
  });
});

describe('canClaimPayment', () => {
  const manual = { status: 'pending', kind: 'manual_transfer' };

  it('offers the button on a live, unclaimed manual order', () => {
    expect(canClaimPayment({ status: 'awaiting_payment' }, manual)).toBe(true);
  });

  it('withdraws it once the buyer has already said so', () => {
    expect(
      canClaimPayment({ status: 'awaiting_payment', buyer_claimed_at: '2026-09-05T04:00:00Z' }, manual),
    ).toBe(false);
  });

  it('never offers it on a gateway order', () => {
    // The buyer there is just as capable of having paid, but the payment
    // announces itself -- a button implying somebody has to be told would
    // teach the wrong thing about how it works.
    expect(canClaimPayment({ status: 'awaiting_payment' }, { status: 'pending', kind: 'qr' })).toBe(
      false,
    );
  });

  it('never offers it outside awaiting_payment, which the server refuses', () => {
    for (const status of ['processing', 'shipped', 'completed', 'cancelled', 'expired']) {
      expect(canClaimPayment({ status }, manual)).toBe(false);
    }
  });

  it('never offers it on a charge that never opened', () => {
    // There is nothing to have paid: a dead intent carries no account number.
    expect(canClaimPayment({ status: 'awaiting_payment' }, { status: 'failed' })).toBe(false);
  });
});

// The bug a live run found and no unit test would have: the shop's own QRIS
// image dead-ended on every deployment whose media origin is plain http, and
// told the buyer no account was set up when one was.
describe('isDisplayableImageURL', () => {
  it('accepts https anywhere', () => {
    expect(isDisplayableImageURL('https://cdn.test/t/x/products/q.png')).toBe(true);
  });

  it('accepts http when the page itself is http', () => {
    // jsdom serves these tests over http, which is also every local and
    // self-hosted deployment whose media origin is plain http.
    expect(location.protocol).toBe('http:');
    expect(isDisplayableImageURL('http://localhost:9000/lilyalora-media/q.png')).toBe(true);
  });

  it('refuses anything that is not a URL at all', () => {
    // The stub's shape, and the one isUsableRedirect guards for the same
    // reason: a relative path leads nowhere from a payment panel.
    expect(isDisplayableImageURL('/dev/media/q.png')).toBe(false);
    expect(isDisplayableImageURL('')).toBe(false);
    expect(isDisplayableImageURL(null)).toBe(false);
  });

  it('is looser than the gateway rule, which must stay strict', () => {
    // isQrImageURL judges a string a provider handed us, and has a Go mirror
    // that cannot consult the page it will render on. This one judges a URL
    // our own server composed. Collapsing the two is what caused the bug.
    const httpUrl = 'http://localhost:9000/q.png';
    expect(isQrImageURL(httpUrl)).toBe(false);
    expect(isDisplayableImageURL(httpUrl)).toBe(true);
  });
});
