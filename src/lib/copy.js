// The words this template draws that a merchant may change. Each one is a
// brand.section_copy key or a brand field; the template's wording is only the
// default behind a blank field. Shop-system wording (buttons, stock notes,
// checkout, payment, errors) stays where it is drawn.

import { fmt } from '@sepetakhq/storefront-kit/shared/format';

/**
 * The template's own wording for every section_copy label it draws. The
 * merchant's text from the backoffice replaces each one; blank keeps these.
 */
export const DEFAULT_LABELS = {
  cats_heading: 'Pilih gayamu',
  grid_see_all: 'Lihat semua →',
  story_eyebrow: 'Cerita kami',
  story_cta: 'Baca cerita kami',
  product_details_heading: 'Detail bahan & ukuran',
  product_care_heading: 'Cara perawatan',
  product_shipping_heading: 'Pengiriman',
  related_heading: 'Kamu mungkin suka',
  about_address_heading: 'Kunjungi kami',
  footer_shop_heading: 'Belanja',
  footer_contact_heading: 'Hubungi kami',
  footer_payment_heading: 'Pembayaran',
  origin_prefix: 'dikirim dari',
};

const trimmed = (v) => String(v ?? '').trim();

/** One label: the merchant's section_copy text, trimmed, else the template's. */
export function sectionText(sections, key) {
  return trimmed(sections?.[key]) || DEFAULT_LABELS[key] || '';
}

/** "dikirim dari Solo", or nothing when the shop has no origin city. */
export function originLine(brand) {
  const city = trimmed(brand?.origin_city);
  return city ? `${sectionText(brand?.sections, 'origin_prefix')} ${city}` : '';
}

/** The merchant's nav label for a path, so a page heading matches its link. */
export function navLabel(nav, path, fallback) {
  return trimmed((nav ?? []).find((n) => n?.path === path)?.label) || fallback;
}

/** The WhatsApp button's words: the merchant's, else the template's. */
export function whatsappText(brand) {
  return trimmed(brand?.whatsapp_text) || 'Chat WhatsApp';
}

/** The hero button's words: the merchant's, else the template's. */
export function heroCta(hero) {
  return trimmed(hero?.cta) || 'Belanja sekarang';
}

/** The campaign pill: the merchant's headline, else what the promotion takes off. */
export function campaignHeadline(c) {
  const own = trimmed(c?.headline);
  if (own) return own;
  if (c?.discount_type === 'percentage') return `Diskon ${c.discount_value}%`;
  return `Potongan ${fmt(c?.discount_value)}`;
}
