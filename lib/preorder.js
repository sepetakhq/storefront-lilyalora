/**
 * Pre-order rules, kept out of the components that render them.
 *
 * A pre-order product is made after it is bought, so its `stock` column says
 * nothing about whether it can be sold. That one fact contradicts three
 * separate places where the storefront re-derives "sold out" from a stock
 * number, and every one of them is a component with no test around it — hence
 * this module.
 *
 * The server is the authority on all of it: `sold_out` already accounts for
 * pre-order, and `preorder_lead_days` arrives resolved against the shop
 * default. Nothing here re-implements either rule; it only stops the client
 * from second-guessing them.
 */

import { isEnded, isScheduled } from './availability.js';
import { MAX_QTY } from '../cart/CartProvider.jsx';

/**
 * How many of this can go in a cart.
 *
 * A made-to-order item is capped by the server's per-line limit rather than by
 * a stock number that means nothing for it. Without this a pre-order product
 * at zero stock pins the quantity stepper to exactly 1.
 */
export function maxQty(product) {
  if (!product) return 1;
  if (product.preorder) return MAX_QTY;
  return Math.min(MAX_QTY, Math.max(1, product.stock));
}

/**
 * How much of this the buyer may still add — the number the cart's `+` button
 * is gated on. Unbounded in practice for a pre-order, which is the point.
 */
export function availableQty(product) {
  if (!product) return 0;
  return product.preorder ? MAX_QTY : (product.stock ?? 0);
}

/**
 * Whether the buyer is blocked from buying this at all.
 *
 * True for a closed sale window as well as an empty shelf: the server folds
 * the two into `sold_out`, because they are one fact to a buyer. A window that
 * has not *opened* is deliberately not in here — see availability.js.
 */
export function isSoldOut(product) {
  if (!product) return false;
  // Trust the server's verdict alone. The `stock <= 0` clause that used to sit
  // beside it here was a second copy of the same rule, and it is the copy that
  // does not know about pre-order.
  return Boolean(product.sold_out);
}

/**
 * The wait, in days, or 0 when the shop has never stated one.
 *
 * Zero is a real answer — "made to order, no date promised" — and is rendered
 * as a bare pre-order note rather than "±0 hari".
 */
export function leadDays(product) {
  if (!product?.preorder) return 0;
  return product.preorder_lead_days > 0 ? product.preorder_lead_days : 0;
}

/**
 * The one-line note under a product: pre-order first, then the ordinary stock
 * ladder. A pre-order product never shows a stock count, because the number is
 * meaningless for it and quoting it invites the buyer to read it as a limit.
 *
 * Butter/gold rather than the pink used for discounts and the red used for
 * scarcity: in this palette gold is the informational tone, and a delivery
 * window is a fact rather than an offer or a warning.
 */
export function stockNote(product) {
  if (!product) return null;
  if (product.preorder) {
    const days = leadDays(product);
    return {
      text: days
        ? `Pre-order · dibuat setelah pembayaran, siap kirim ±${days} hari`
        : 'Pre-order · dibuat setelah pembayaran',
      color: '#8A6D1F',
    };
  }
  const stock = product.stock;
  if (stock <= 0) return { text: 'Stok habis — segera restock!', color: '#C05C7E' };
  if (stock < 10) return { text: `Sisa ${stock} pcs — jangan sampai kehabisan`, color: '#C08A2D' };
  return { text: `Stok tersedia (${stock} pcs)`, color: '#3E7D4E' };
}

/**
 * The short form used on a cart line, where there is room for the wait but not
 * for a sentence.
 */
export function shortNote(product) {
  if (!product?.preorder) return null;
  const days = leadDays(product);
  return days ? `Pre-order · ±${days} hari setelah pembayaran` : 'Pre-order · dibuat setelah dipesan';
}

/**
 * One sentence for a whole cart or order, given the longest wait on it.
 *
 * An order ships once, so a mixed cart waits for its slowest item — the buyer
 * is quoted one wait, not one per line.
 */
export function orderNote(days) {
  if (!days) return null;
  return `Termasuk produk pre-order · dikirim ±${days} hari setelah pembayaran diterima`;
}

/**
 * The cart line's state, in priority order.
 *
 * Lifted out of useCartLines so the pre-order exemptions are testable: both
 * stock rungs are skipped for a made-to-order product, because `stock: 0` is
 * not "sold out" for it and `qty > stock` is not "more than we have".
 */
export function cartLineStatus(item, product, query) {
  if (query?.isPending) return 'loading';
  // A 404 means unpublished or deleted — the product is gone, not broken.
  if (query?.error?.status === 404) return 'gone';
  if (query?.isError) return 'error';
  if (!product) return 'error';
  // Both window rungs sit above the pre-order exemption, mirroring the
  // server's own precedence: a made-to-order drop that has not opened cannot
  // be bought either, and a line that says 'ok' here is a line the checkout
  // would refuse.
  if (isScheduled(product)) return 'scheduled';
  if (isEnded(product)) return 'ended';
  if (product.preorder) return 'ok';
  if (isSoldOut(product) || product.stock <= 0) return 'soldout';
  if (item.qty > product.stock) return 'overstock';
  return 'ok';
}
