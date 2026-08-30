/**
 * A QRIS payload is an EMVCo string: it always opens with `000201`, the
 * payload-format indicator, and carries the merchant and amount as numbered
 * tags after it.
 *
 * The test is deliberately positive rather than a list of things to reject.
 * Two real cases already fail it, and neither announces itself: the stub
 * gateway emits `STUB-QRIS|…`, and Sakurupiah returns a URL to a QR *image* it
 * drew, in the field where the payload belongs.
 *
 * That URL was first read as a sandbox quirk — the sandbox serves one sample
 * image for every transaction. A production charge on 2026-08-30 returned a
 * URL too, so it is simply how Sakurupiah answers QRIS, and the backend now
 * classifies the value and routes it to `qr_image`. Nothing shaped like a URL
 * should reach this function any more; it stays as the second lock, because
 * the failure it prevents is a code that scans and opens a web page.
 *
 * Encoding either produces a code that scans perfectly and does the wrong
 * thing — fails inside a banking app, or worse, opens a web page instead of
 * paying. That is worse than showing no code at all, so only something shaped
 * like a real payload reaches the encoder.
 */
export function isQrisPayload(v) {
  return typeof v === 'string' && v.startsWith('000201') && v.length > 40;
}

/**
 * The stub gateway points e-wallets at `/dev/pay/<ref>`, a route that exists
 * nowhere. Offering it as a button would be a dead end, so a redirect is only
 * followed when it leads off this site.
 */
export function isUsableRedirect(v) {
  return typeof v === 'string' && (v.startsWith('https://') || v.startsWith('http://'));
}

/**
 * Some providers never hand over the payload at all: they draw the QR
 * themselves and return a URL to the image. Midtrans answers a QRIS charge
 * that way and includes no EMVCo string anywhere in the response.
 *
 * Two shapes are unusable here and neither announces itself. An `http://` URL
 * is dropped as mixed content on an https storefront, and the buyer gets a
 * broken image where the code should be. A relative path is the stub's shape
 * and leads nowhere, the same dead end `isUsableRedirect` guards.
 *
 * Deliberately not restricted to one provider's host. The storefront branches
 * on kind and never on gateway, so a second provider that draws its own QR
 * must not need a change here.
 */
export function isQrImageURL(v) {
  return typeof v === 'string' && v.startsWith('https://');
}
