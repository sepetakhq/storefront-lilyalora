/**
 * The WhatsApp handoff: an order placed on the site, sent to the merchant as
 * the first message of a chat.
 *
 * The server hands the page a bare phone number and nothing else, because the
 * message is buyer copy — worded for a person — and copy belongs to the
 * storefront. Everything in it is already on the order page; the buyer is
 * sending the merchant what they can see.
 *
 * The layout is decided here once; the words come from the caller, because a
 * template that reads in another language reuses the layout and swaps the
 * sentences (templates/balilinen/src/lib/copy.js has the English set).
 */

import { fmt } from '../shared/format.js';

/** The Indonesian wording, and the default for the storefront in src/. */
export const ID_MESSAGE = {
  greeting: (number) => `Halo, saya mau pesan #${number}`,
  subtotal: 'Subtotal',
  discount: 'Diskon',
  shipping: 'Ongkir',
  shippingDiscount: 'Diskon ongkir',
  total: 'Total',
  onBehalf: (name, city) => `Atas nama ${name}${city ? `, ${city}` : ''}`,
  detail: 'Detail pesanan',
};

/**
 * The first message of the chat, as the merchant will read it.
 *
 * Exported separately from the link so the page can show the buyer exactly
 * what they are about to send. The tracking URL is deliberately last: it is
 * how the merchant finds the order, and the one line they will tap.
 */
export function orderMessage(order, trackUrl, t = ID_MESSAGE) {
  const lines = (order.lines ?? []).map(
    (l) => `- ${l.qty}× ${l.name}${l.variant_label ? ` (${l.variant_label})` : ''}`,
  );
  const parts = [t.greeting(order.number), '', ...lines, '', `${t.subtotal}: ${fmt(order.subtotal)}`];
  if (order.discount_total > 0) parts.push(`${t.discount}: -${fmt(order.discount_total)}`);
  parts.push(
    `${t.shipping}: ${fmt(order.shipping_cost)}${order.courier_code ? ` (${order.courier_code})` : ''}`,
  );
  if (order.shipping_discount > 0) parts.push(`${t.shippingDiscount}: -${fmt(order.shipping_discount)}`);
  parts.push(`${t.total}: ${fmt(order.total)}`);
  parts.push('');
  parts.push(t.onBehalf(order.customer_name, order.city));
  if (trackUrl) parts.push(`${t.detail}: ${trackUrl}`);
  return parts.join('\n');
}

/**
 * A wa.me link that opens the chat with the message typed in.
 *
 * The phone is stored as bare 62… digits, which is what wa.me wants; anything
 * else is stripped here so a hand-edited config still opens a chat.
 */
export function waLink(phone, text) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
