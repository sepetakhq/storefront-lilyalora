import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fmt, shippingCopy } from '../shared/format.js';

afterEach(cleanup);

// Mutated rather than re-mocked, because vi.mock is hoisted above anything a
// test could parameterise.
let product = {};
let freeShipping = true;
const brand = { productShippingCopy: '' };

vi.mock('../config/ConfigProvider.jsx', () => ({
  useConfig: () => ({
    brand,
    freeShipping,
    freeShippingMinLabel: fmt(150000),
    // The real provider's helper, wired the same way, so these tests exercise
    // the actual withholding rule rather than a stand-in for it.
    copy: (s) => shippingCopy(s, { free_shipping_min: fmt(150000) }, freeShipping),
  }),
}));

vi.mock('../hooks/queries.js', () => ({
  useProduct: () => ({ data: product, isPending: false, isError: false, refetch: () => {} }),
}));

vi.mock('../cart/CartProvider.jsx', () => ({
  useCart: () => ({ add: () => {}, lines: [] }),
  MAX_QTY: 99,
}));

vi.mock('../ui/ToastProvider.jsx', () => ({
  useToast: () => () => {},
}));

const ProductRoute = (await import('./ProductRoute.jsx')).default;

function withProduct(p) {
  product = {
    id: 'p1',
    slug: 'voal-butter-daisy',
    name: 'Voal Butter Daisy',
    price: 79000,
    stock: 5,
    sold_out: false,
    preorder: false,
    preorder_lead_days: 0,
    availability: 'available',
    images: [],
    related: [],
    description: '',
    spec_label: '',
    material_spec: '',
    care_copy: '',
    ...p,
  };
}

function panel() {
  return render(
    <MemoryRouter initialEntries={['/produk/voal-butter-daisy']}>
      <ProductRoute />
    </MemoryRouter>,
  );
}

describe('ProductRoute detail panel', () => {
  afterEach(() => {
    freeShipping = true;
    brand.productShippingCopy = '';
  });

  it('renders every section when each one has something to say', () => {
    brand.productShippingCopy = 'Dikirim dari Pekalongan.';
    withProduct({ material_spec: 'Voal 115×115 cm', care_copy: 'Cuci tangan.' });
    panel();

    expect(screen.getByText('Detail bahan & ukuran')).toBeTruthy();
    expect(screen.getByText('Cara perawatan')).toBeTruthy();
    expect(screen.getByText('Pengiriman')).toBeTruthy();
  });

  // The whole point of the change: the server resolved the chain, so the page
  // renders what it was handed and never reaches into the shop config for a
  // fallback of its own. The two differ here so only one of them can pass.
  it('renders the care copy the server resolved, not the shop-wide copy', () => {
    brand.productCareCopy = 'Perawatan toko';
    withProduct({ care_copy: 'Perawatan produk ini' });
    panel();

    expect(screen.getByText('Perawatan produk ini')).toBeTruthy();
    expect(screen.queryByText('Perawatan toko')).toBeNull();
  });

  // The bug this closes: the section used to render unconditionally, so a shop
  // that had never written care copy got a panel that opened onto nothing.
  it('hides “Cara perawatan” when no tier filled it', () => {
    brand.productShippingCopy = 'Dikirim dari Pekalongan.';
    withProduct({ care_copy: '' });
    panel();

    expect(screen.queryByText('Cara perawatan')).toBeNull();
    expect(screen.getByText('Pengiriman')).toBeTruthy();
  });

  it('hides “Detail bahan & ukuran” when nothing supplied a spec', () => {
    brand.productShippingCopy = 'Dikirim dari Pekalongan.';
    withProduct({ material_spec: '' });
    panel();

    expect(screen.queryByText('Detail bahan & ukuran')).toBeNull();
  });

  // The other half of the same bug: the border rule above the sections was
  // ungated too, so a product with nothing to say drew a bare line under the
  // buy button and stopped there.
  it('renders no panel at all, and no rule, when every section is empty', () => {
    freeShipping = false;
    brand.productShippingCopy = '';
    withProduct({});
    const { container } = panel();

    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('splits care copy into one paragraph per blank line', () => {
    withProduct({ care_copy: 'Cuci tangan.\n\nJangan diperas.' });
    panel();

    expect(screen.getByText('Cuci tangan.')).toBeTruthy();
    expect(screen.getByText('Jangan diperas.')).toBeTruthy();
  });

  it('substitutes {free_shipping_min} in care copy while the offer stands', () => {
    withProduct({ care_copy: 'Gratis ongkir di atas {free_shipping_min}.' });
    panel();

    expect(screen.getByText(`Gratis ongkir di atas ${fmt(150000)}.`)).toBeTruthy();
  });

  // Sentence by sentence, exactly as the shop-wide copy has always been
  // treated -- a promise the checkout would refuse is withheld, and the rest of
  // the paragraph survives.
  it('withholds only the sentence that promises free shipping once it is off', () => {
    freeShipping = false;
    withProduct({
      care_copy: 'Cuci tangan. Gratis ongkir di atas {free_shipping_min}. Setrika suhu rendah.',
    });
    panel();

    expect(screen.getByText(/Cuci tangan\./)).toBeTruthy();
    expect(screen.queryByText(/Gratis ongkir/)).toBeNull();
  });

  // And when that sentence was the whole of it, the section goes rather than
  // opening onto an empty panel. It does not fall back to another tier: the
  // server already resolved, and these are the words this merchant chose.
  it('hides the section when the withheld sentence was all there was', () => {
    freeShipping = false;
    brand.productShippingCopy = 'Dikirim dari Pekalongan.';
    withProduct({ care_copy: 'Gratis ongkir di atas {free_shipping_min}.' });
    panel();

    expect(screen.queryByText('Cara perawatan')).toBeNull();
  });

  // Copy a merchant typed into the backoffice. The shortest path from "let
  // them use bold" to "let them inject a script" runs through this element.
  it('renders care copy as text, never as markup', () => {
    withProduct({ care_copy: '<img src=x onerror="alert(1)"><b>tebal</b>' });
    const { container } = panel();

    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText('<img src=x onerror="alert(1)"><b>tebal</b>')).toBeTruthy();
  });

  // The pre-order and free-shipping lines are platform facts rather than brand
  // voice, so they are still written here and still appear on their own.
  it('keeps “Pengiriman” when only the hardcoded pre-order line applies', () => {
    freeShipping = false;
    brand.productShippingCopy = '';
    withProduct({ preorder: true, preorder_lead_days: 8, stock: 0 });
    panel();

    expect(screen.getByText('Pengiriman')).toBeTruthy();
    // Matched on the panel's own sentence, not on the lead time alone: the
    // stock note above the buy button names the same number.
    expect(screen.getByText(/Perkiraan siap kirim ±8 hari/)).toBeTruthy();
  });
});
