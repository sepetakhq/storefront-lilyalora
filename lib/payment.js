/**
 * A QRIS payload is an EMVCo string: it always opens with `000201`, the
 * payload-format indicator, and carries the merchant and amount as numbered
 * tags after it.
 *
 * The test is deliberately positive rather than a list of things to reject.
 * Two real cases already fail it, and neither announces itself: the stub
 * gateway emits `STUB-QRIS|…`, and Sakurupiah's sandbox returns a URL to a
 * sample QR *image* in the field where the payload belongs
 * (`…/sakurupiah-sanbox-sampleQR.png`, the same one for every transaction).
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
