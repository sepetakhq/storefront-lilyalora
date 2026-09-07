/**
 * Sale windows, kept out of the components that render them.
 *
 * A product can now be listed and indexed before it is buyable: a drop that
 * opens on Friday, a flash sale that closes at midnight, a limited edition
 * that stops selling on a date. The server decides which of those a product is
 * in, on its own clock, and says so in `availability`.
 *
 * Nothing here re-derives that. The two timestamps beside it exist to say
 * *when*, so the page can render a date and a countdown — never to be compared
 * against a browser clock in order to decide whether the buy button works. A
 * laptop with the wrong time would otherwise open a drop early and take a 409
 * at checkout, which is the worse of the two failures by a distance.
 *
 * Sibling to preorder.js and written to the same doctrine, because they answer
 * neighbouring questions about the same card: that one is "when will it
 * arrive", this one is "when may I buy it".
 */

import { fmtDateTime } from '../shared/format.js';

export const AVAILABLE = 'available';
export const SCHEDULED = 'scheduled';
export const ENDED = 'ended';
export const SOLD_OUT = 'sold_out';

/**
 * The server's verdict.
 *
 * Defaults to `available` when the field is missing, which is what an API
 * older than this feature returns. The stock rules downstream still apply, so
 * a missing field degrades to exactly the behaviour that shipped before
 * windows existed rather than to a page that refuses to sell anything.
 */
export function saleState(product) {
  return product?.availability ?? AVAILABLE;
}

/** Whether the shop has not opened this yet. */
export function isScheduled(product) {
  return saleState(product) === SCHEDULED;
}

/** Whether the sale is over. Distinct from sold out: there was never a shelf. */
export function isEnded(product) {
  return saleState(product) === ENDED;
}

/**
 * When the sale opens, or null.
 *
 * Null for a product with no schedule *and* for one whose window has already
 * opened — a past opening is not news, and every caller wants "is there a date
 * to show" rather than "was there ever one".
 */
export function opensAt(product) {
  if (!isScheduled(product) || !product?.sell_from) return null;
  const d = new Date(product.sell_from);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** When the sale closes, or null when it never does. */
export function closesAt(product) {
  if (!product?.sell_until) return null;
  const d = new Date(product.sell_until);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The short label for a card overlay: two lines, the second optional.
 *
 * Returns null for a product the buyer can act on, so a component renders the
 * overlay on truthiness and never has to know the state names.
 */
export function overlayLabel(product) {
  switch (saleState(product)) {
    case SCHEDULED: {
      const at = opensAt(product);
      return { title: 'SEGERA', detail: at ? fmtDateTime(at) : null };
    }
    case ENDED:
      return { title: 'SUDAH DITUTUP', detail: null };
    case SOLD_OUT:
      return { title: 'HABIS', detail: null };
    default:
      return null;
  }
}

/**
 * The sentence under a product, or null when the window has nothing to say.
 *
 * Deliberately separate from preorder.js's stockNote rather than folded into
 * it: a scheduled pre-order is an ordinary thing, and the buyer is owed both
 * facts — when they may buy it, and how long it takes to make.
 *
 * Ink on the warm neutral rather than the pink used for offers or the gold
 * used for delivery: a closed door is neither a promise nor a discount.
 */
export function windowNote(product) {
  switch (saleState(product)) {
    case SCHEDULED: {
      const at = opensAt(product);
      return {
        text: at ? `Dibuka ${fmtDateTime(at)}` : 'Belum dibuka',
        color: '#6E4634',
      };
    }
    case ENDED:
      return { text: 'Penjualan sudah ditutup', color: '#8A7D70' };
    default: {
      // A closing time is worth stating while it can still be acted on. Only
      // when one exists: most products never close, and "berlaku sampai" on
      // every card would be noise.
      const until = closesAt(product);
      if (!until) return null;
      return { text: `Berlaku sampai ${fmtDateTime(until)}`, color: '#8A6D1F' };
    }
  }
}

/** The label on a disabled buy button. Null when the button should work. */
export function buyLabel(product) {
  switch (saleState(product)) {
    case SCHEDULED: {
      const at = opensAt(product);
      return at ? `Dibuka ${fmtDateTime(at)}` : 'Belum dibuka';
    }
    case ENDED:
      return 'Penjualan ditutup';
    case SOLD_OUT:
      return 'Stok habis';
    default:
      return null;
  }
}

/**
 * How long until the sale opens, in milliseconds, or null when there is
 * nothing to count down to.
 *
 * `now` is passed in so the caller owns the tick and this stays a pure
 * function. Capped below at zero: a countdown that has run out reads 0:00
 * until the server confirms the opening, and never goes negative on screen.
 */
export function msUntilOpen(product, now) {
  const at = opensAt(product);
  if (!at) return null;
  return Math.max(0, at.getTime() - now);
}

/**
 * Whether the opening is close enough to be worth ticking a clock for.
 *
 * A drop three weeks out gets a date, not a countdown: a page that re-renders
 * every second for three weeks spends a phone's battery to tell the buyer
 * nothing they could not read once. Twelve hours is the point where the
 * seconds start to matter to someone waiting.
 */
export function isImminent(product, now) {
  const ms = msUntilOpen(product, now);
  return ms !== null && ms <= 12 * 60 * 60 * 1000;
}

/**
 * Cart-line statuses the checkout draft would refuse.
 *
 * The canonical list, imported by useCartLines rather than repeated there:
 * a status added to the ladder in preorder.js and forgotten here is a line the
 * buyer is allowed to take to checkout and be refused at.
 */
const BLOCKING = ['gone', 'soldout', 'scheduled', 'ended'];

export function isBlocking(status) {
  return BLOCKING.includes(status);
}

/**
 * What the cart says above the checkout button, or null when nothing blocks.
 *
 * Two sentences rather than one, because they ask for opposite actions. A
 * sold-out or deleted line has to go before checkout will work. A drop that
 * has not opened is worth keeping — telling that buyer to delete it would talk
 * them out of the purchase the shop is building anticipation for.
 */
export function blockerNotice(statuses) {
  const blocking = (statuses ?? []).filter(isBlocking);
  if (blocking.length === 0) return null;
  if (blocking.every((s) => s === SCHEDULED)) {
    return 'Ada produk yang belum dibuka. Simpan di keranjang dan kembali saat penjualannya mulai, atau hapus untuk checkout sekarang.';
  }
  return 'Ada produk yang sudah tidak tersedia. Hapus dulu sebelum lanjut ke checkout.';
}
