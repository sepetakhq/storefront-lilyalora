import { describe, expect, it } from 'vitest';

import { orderMessage, waLink } from './whatsapp.js';

const order = {
  number: 'LA-260911-0007',
  customer_name: 'Nadia',
  city: 'Pekalongan',
  courier_code: 'JNE',
  subtotal: 158000,
  discount_total: 0,
  shipping_cost: 12000,
  shipping_discount: 0,
  total: 170000,
  lines: [
    { qty: 2, name: 'Voal Polos' },
    { qty: 1, name: 'Scarf Bunga' },
  ],
};

describe('orderMessage', () => {
  it('reads as one message the merchant can act on', () => {
    const msg = orderMessage(order, 'https://shop.test/track/abc');
    expect(msg).toBe(
      [
        'Halo, saya mau pesan #LA-260911-0007',
        '',
        '- 2× Voal Polos',
        '- 1× Scarf Bunga',
        '',
        'Subtotal: Rp 158.000',
        'Ongkir: Rp 12.000 (JNE)',
        'Total: Rp 170.000',
        '',
        'Atas nama Nadia, Pekalongan',
        'Detail pesanan: https://shop.test/track/abc',
      ].join('\n'),
    );
  });

  it('names a discount only when there is one', () => {
    const msg = orderMessage({ ...order, discount_total: 8000, shipping_discount: 12000 }, '');
    expect(msg).toContain('Diskon: -Rp 8.000');
    expect(msg).toContain('Diskon ongkir: -Rp 12.000');
    expect(msg).not.toContain('Detail pesanan');
  });

  it('survives an order with no lines yet', () => {
    expect(orderMessage({ ...order, lines: undefined }, '')).toContain('Subtotal');
  });
});

describe('waLink', () => {
  it('builds a wa.me link with the message encoded', () => {
    const link = waLink('6281234567890', 'Halo #1\nTotal: Rp 1.000');
    expect(link).toBe('https://wa.me/6281234567890?text=Halo%20%231%0ATotal%3A%20Rp%201.000');
  });

  it('strips anything that is not a digit from the phone', () => {
    expect(waLink('+62 812-3456-7890', 'x')).toBe('https://wa.me/6281234567890?text=x');
  });

  it('refuses to open a chat with nobody', () => {
    expect(waLink('', 'x')).toBe('');
    expect(waLink(undefined, 'x')).toBe('');
  });
});
