/**
 * The voucher code field, and what the summary says about it afterwards.
 *
 * The rule this module exists to keep is that it owns no vocabulary. Whether a
 * code worked, and the sentence explaining why it did not, are both decided by
 * the server -- which is the only side that knows the promotion, the window
 * and the cart it was measured against. A reason table here would be a second
 * source of truth that goes stale the moment the backend learns a new one.
 */

/**
 * What the buyer types, reduced to what will actually be sent.
 *
 * Mirrors promo.NormalizeCode on the server byte for byte, and is applied as
 * the field is typed rather than on submit. The point is that the two never
 * disagree in front of the buyer: a code pasted out of a bio with a stray
 * space or a zero-width character is cleaned up where they can see it happen,
 * instead of being sent as something the server then says it does not know.
 */
export function normalizeVoucherInput(raw) {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
}

/** The longest code the API will store. */
export const MAX_VOUCHER_LEN = 32;

/**
 * The notes a draft's voucher outcome adds under the summary.
 *
 * Notes only, deliberately. When a code does apply, the discount it produced
 * already has a row -- the summary's existing Diskon or Ongkir line -- and
 * adding a second one would show the same rupiah twice and make the footer
 * look as though it did not add up. What is left over is what the rows cannot
 * say: why a code did nothing, and when accepting it cost the buyer money.
 *
 * Empty whenever no code was sent, so a buyer who never used one sees exactly
 * the summary they saw before vouchers existed.
 */
export function voucherNotes(draft) {
  const v = draft?.voucher;
  if (!v || !v.code) return [];

  if (!v.applied) {
    return [{ tone: 'warn', text: v.message || 'Kode itu tidak bisa dipakai.' }];
  }
  const note = betterAutomaticNote(v);
  return note ? [{ tone: 'muted', text: note }] : [];
}

/**
 * The label for the row a voucher discounted, or null to leave it alone.
 *
 * The code is what the buyer recognises -- they typed it, and the campaign
 * name is the merchant's word for the same thing -- so it wins the label when
 * there is one.
 */
export function voucherLabel(draft, fallback) {
  const v = draft?.voucher;
  if (v?.applied && v.code) return `Kode ${v.code}`;
  return fallback;
}

/**
 * The sentence shown when the shop's own promotion would have given more.
 *
 * The code the buyer typed always wins its target, so this is the one case
 * where entering a code left them worse off than entering nothing. Saying so
 * is the whole reason the server sends `outbid`: a buyer who finds that out
 * later, from the total, has been quietly overcharged by a feature that was
 * supposed to help them.
 *
 * Strictly greater, matching the server: an equal automatic promotion gave up
 * nothing and there is nothing to report.
 */
export function betterAutomaticNote(voucher) {
  const outbid = Number(voucher?.outbid) || 0;
  const amount = Number(voucher?.amount) || 0;
  if (!voucher?.applied || outbid <= amount) return null;

  const name = voucher.outbid_name ? `Promo "${voucher.outbid_name}"` : 'Promo toko';
  return `${name} sebenarnya memberi potongan lebih besar, tapi kode ${voucher.code} yang dipakai.`;
}
