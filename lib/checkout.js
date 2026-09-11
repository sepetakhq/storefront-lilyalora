/**
 * The checkout's language-free arithmetic, shared by every storefront bundle.
 *
 * Everything here mirrors a server rule so the estimate does not contradict
 * the draft, and everything here is advisory: the number that actually
 * charges anyone comes from the draft.
 */

/**
 * What paying with this method will add, before the draft says for certain.
 *
 * A three-line mirror of payment.ChannelFee.On, rounding up for the same
 * reason it does, so this lands a few rupiah *above* the authoritative fee
 * rather than below it -- a buyer shown a slightly high estimate and then
 * charged less has been treated fairly, and the reverse has not.
 */
export function estimatePaymentFee(base, method) {
  const flat = method?.fee_flat ?? 0;
  const bps = method?.fee_basis_pt ?? 0;
  if (!flat && !bps) return 0;
  if (!(base > 0)) return flat;
  return flat + Math.ceil((base * bps) / 10000);
}

/**
 * Whether this cart is within what the method's channel accepts. The bounds
 * arrive already in order-value terms; zero means the channel states no bound.
 */
export function methodFits(method, base) {
  if (!(base > 0)) return true;
  const min = method?.min_order_total ?? 0;
  const max = method?.max_order_total ?? 0;
  if (min > 0 && base < min) return false;
  if (max > 0 && base > max) return false;
  return true;
}

/**
 * `free` is the whole offer -- `{ enabled, min }` -- because the threshold
 * alone cannot express a shop that has withdrawn it.
 */
export function estimateShipping(subtotal, courier, free) {
  if (!courier) return 0;
  return free.enabled && subtotal >= free.min ? 0 : courier.cost;
}

/**
 * Which of the three things the confirm button does.
 *
 *   'reopen'  a code is already sent and still inside its window.
 *   'place'   this browser already proved this address recently (trust.go).
 *   'send'    the ordinary path, and what an older API's response reads as.
 */
export function confirmStep({ otpRequired, otp, now = Date.now() }) {
  if (otp && Date.parse(otp.expiresAt) > now) return 'reopen';
  return otpRequired === false ? 'place' : 'send';
}
