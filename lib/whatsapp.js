/**
 * The WhatsApp handoff: an order placed on the site, sent to the merchant as
 * the first message of a chat.
 *
 * The server hands the page a bare phone number and nothing else, because the
 * message is buyer copy — Indonesian, worded for a person — and copy belongs
 * here. Everything in it is already on the order page; the buyer is sending
 * the merchant what they can see.
 */

import { fmt } from '../shared/format.js';

/**
 * The first message of the chat, as the merchant will read it.
 *
 * Exported separately from the link so the page can show the buyer exactly
 * what they are about to send. The tracking URL is deliberately last: it is
 * how the merchant finds the order, and the one line they will tap.
 */
export function orderMessage(order, trackUrl) {
  const lines = (order.lines ?? []).map((l) => `- ${l.qty}× ${l.name}`);
  const parts = [
    `Halo, saya mau pesan #${order.number}`,
    '',
    ...lines,
    '',
    `Subtotal: ${fmt(order.subtotal)}`,
  ];
  if (order.discount_total > 0) parts.push(`Diskon: -${fmt(order.discount_total)}`);
  parts.push(`Ongkir: ${fmt(order.shipping_cost)}${order.courier_code ? ` (${order.courier_code})` : ''}`);
  if (order.shipping_discount > 0) parts.push(`Diskon ongkir: -${fmt(order.shipping_discount)}`);
  parts.push(`Total: ${fmt(order.total)}`);
  parts.push('');
  parts.push(`Atas nama ${order.customer_name}${order.city ? `, ${order.city}` : ''}`);
  if (trackUrl) parts.push(`Detail pesanan: ${trackUrl}`);
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
