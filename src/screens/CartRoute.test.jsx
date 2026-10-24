import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { qtyLimits } from '@sepetakhq/storefront-kit/shared/qty';

afterEach(cleanup);

const calls = [];
let lines = [];
vi.mock('@sepetakhq/storefront-kit/cart/CartProvider', () => ({
  useCart: () => ({
    isEmpty: false,
    setQty: (...a) => calls.push(['setQty', ...a]),
    remove: (...a) => calls.push(['remove', ...a]),
  }),
}));
vi.mock('@sepetakhq/storefront-kit/cart/useCartLines', () => ({
  useCartLines: () => ({ lines, statuses: [], subtotal: 0, isLoading: false, hasBlockers: false, preorderLeadDays: 0 }),
}));
vi.mock('@sepetakhq/storefront-kit/config/ConfigProvider', () => ({
  useConfig: () => ({ freeShipping: false, freeShippingMin: 0 }),
}));

const { default: CartRoute } = await import('./CartRoute.jsx');

function draw(product, qty) {
  calls.length = 0;
  const p = { id: 'p1', slug: 'kain', name: 'Kain', price: 80000, stock: 5000, availability: 'available', ...product };
  lines = [{ item: { productId: 'p1', qty }, key: 'p1', product: p, status: 'ok', available: p.stock, limits: qtyLimits(p) }];
  render(
    <MemoryRouter>
      <CartRoute />
    </MemoryRouter>,
  );
}

describe('CartRoute: sale units', () => {
  it('prints a weighed line in kg and steps it by qty_step', () => {
    draw({ unit: 'kg', qty_step: 100, qty_min: 500 }, 1250);
    expect(screen.getByText('1,25 kg')).toBeTruthy();
    expect(screen.getByText('Rp 80.000/kg')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tambah jumlah' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kurangi jumlah' }));
    expect(calls).toEqual([['setQty', 'p1', 1350], ['setQty', 'p1', 1150]]);
  });

  it('removes the line when minus goes below the minimum', () => {
    draw({ unit: 'kg', qty_step: 100, qty_min: 500 }, 500);
    fireEvent.click(screen.getByRole('button', { name: 'Kurangi jumlah' }));
    expect(calls).toEqual([['remove', 'p1']]);
  });

  it('keeps pieces a bare number, capped by stock', () => {
    draw({ stock: 3 }, 3);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Rp 80.000')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tambah jumlah' }).disabled).toBe(true);
  });
});
