/**
 * The one canonical spelling of a voucher code, shared by both apps.
 *
 * Three places reduce a code and they have to agree exactly: the merchant
 * types it in the backoffice, the buyer types it at checkout, and the server
 * looks it up. Disagreement is invisible until it is expensive -- a merchant
 * prints a code on a story, and it fails at checkout with an error that names
 * no cause, because the two fields cleaned it up differently.
 *
 * This module is that agreement for the JavaScript half. The other half is
 * promo.NormalizeCode, and voucherCode.fixtures.json is read by both suites so
 * neither can drift without a test saying so.
 */

/** The longest code the API will store. Mirrors promo.MaxCodeLen. */
export const MAX_CODE_LEN = 32;

/** The shortest. Four is entropy, not neatness: see promo.MinCodeLen. */
export const MIN_CODE_LEN = 4;

/**
 * Reduce a code to what will actually be sent: uppercase, nothing outside
 * [A-Z0-9-].
 *
 * Filter first, then uppercase -- the order is the whole point, and both JS
 * copies of this used to have it backwards. Go drops every byte outside the
 * ASCII set before it changes any case, so "ﬁ" and "ı" vanish there; in JS
 * .toUpperCase() turns them into "FI" and "I" first, and a filter after that
 * happily keeps them. A merchant pasting either from a styled bio then saved a
 * code the buyer's field spelled differently.
 *
 * Applied as the field is typed rather than on submit, in both apps, so the
 * cleanup happens where the person can see it.
 */
export function normalizeVoucherCode(raw) {
  return String(raw ?? '')
    .replace(/[^A-Za-z0-9-]/g, '')
    .toUpperCase();
}
