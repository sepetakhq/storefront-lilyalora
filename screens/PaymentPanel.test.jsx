import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Testing Library only registers its own cleanup when vitest runs with
// globals, which this project does not. Without it each render is appended to
// the same document and a second panel makes every query ambiguous.
afterEach(cleanup);

// The panel reads brand copy and QRIS merchant details from the tenant config.
// Mocked rather than wrapped in a real ConfigProvider, which would need a
// network request and a QueryClient to answer a question about rendering.
vi.mock('../config/ConfigProvider.jsx', () => ({
  useConfig: () => ({
    brand: { whatsapp_url: 'https://wa.me/6285641232507' },
    payment: { qris_merchant_name: 'LILY ALORA', qris_nmid: 'ID10261234567', account_holder: 'LILY ALORA' },
  }),
}));

const { PaymentPanel } = await import('./OrderRoute.jsx');

// A real EMVCo payload, the same string src/lib/payment.test.js and the Go
// classifier use.
const emvco =
  '00020101021226670016COM.NOBUBANK.WWW01189360050300000898240214' +
  '1234567890123450303UMI51440014ID.CO.QRIS.WWW0215ID10261234567890303UMI' +
  '5204541153033605802ID5910LILY ALORA6010PEKALONGAN61055111162070703A016304ABCD';

const order = {
  order_number: 'LA-260830-0001',
  status: 'awaiting_payment',
  total: 75000,
  // An hour out, so the panel is not in its past-deadline branch.
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
};

// The copy the buyer sees when the storefront cannot render what it was given.
// Its presence is the failure this whole file exists to catch.
const DEAD_END = /QRIS mode uji|Metode pembayaran ini belum aktif/;

function panel(payment) {
  render(<PaymentPanel order={order} payment={payment} onRefresh={() => {}} />);
}

// This is the seam the QRIS defect lived in. The adapter filled a field, the
// route agreed, the DTO serialised it and every layer's own tests passed --
// and the buyer got a panel saying the method was switched off. Nothing below
// asserts styling; it asserts that each kind the backend can emit produces
// something a buyer can act on.
describe('PaymentPanel renders every kind the backend can emit', () => {
  it('va: shows the account number to transfer to', () => {
    panel({ kind: 'va', method: 'BCA', amount: 75000, va_bank: 'BCA', va_number: '31086616057511859904943' });

    expect(screen.getByText(/31086616057511859904943/)).toBeTruthy();
    expect(screen.queryByText(DEAD_END)).toBeNull();
  });

  it('qr: encodes an EMVCo payload rather than refusing it', () => {
    panel({ kind: 'qr', method: 'QRIS', amount: 75000, qr_payload: emvco });

    expect(screen.queryByText(DEAD_END)).toBeNull();
  });

  it('qr_image: shows the image the provider drew', () => {
    panel({
      kind: 'qr_image',
      method: 'QRIS',
      amount: 75000,
      qr_image_url: 'https://sakurupiah.id/qr-codeIMG/TRX1788086870-PDC3yb2gKMT.png',
    });

    const img = screen.getByAltText(/QRIS/i);
    expect(img.getAttribute('src')).toContain('sakurupiah.id');
    expect(screen.queryByText(DEAD_END)).toBeNull();
  });

  it('redirect: offers a link that leaves this site', () => {
    panel({
      kind: 'redirect',
      method: 'GOPAY',
      amount: 75000,
      redirect_url: 'https://pay.example/checkout/abc123',
    });

    expect(screen.queryByText(DEAD_END)).toBeNull();
  });
});

// The cases where the dead end is correct. Showing a code that scans and does
// the wrong thing is worse for a buyer than showing none, so these must keep
// falling back.
describe('PaymentPanel refuses what it cannot render', () => {
  it('falls back when a URL arrives in the payload field', () => {
    // Exactly the bug: Sakurupiah returns an image URL, the old adapter stored
    // it as a qr payload, and kind said "qr". The storefront was right to
    // refuse -- which is why the fix belongs in the adapter, not here.
    panel({
      kind: 'qr',
      method: 'QRIS',
      amount: 75000,
      qr_payload: 'https://sakurupiah.id/qr-codeIMG/TRX1788086870-PDC3yb2gKMT.png',
    });

    expect(screen.getByText(/QRIS mode uji/)).toBeTruthy();
  });

  it('falls back on an http image, which the browser drops as mixed content', () => {
    panel({
      kind: 'qr_image',
      method: 'QRIS',
      amount: 75000,
      qr_image_url: 'http://sakurupiah.id/qr-codeIMG/TRX-1.png',
    });

    expect(screen.getByText(/QRIS mode uji/)).toBeTruthy();
  });

  it('offers a person when there is no payment at all', () => {
    // An intent that failed to open. The order is still valid and payable, so
    // this must not look like an error page.
    panel(null);

    expect(screen.getByText(/Instruksi pembayaran belum tersedia/)).toBeTruthy();
  });
});
