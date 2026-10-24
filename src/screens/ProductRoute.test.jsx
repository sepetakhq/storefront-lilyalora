import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fmt, shippingCopy } from '@sepetakhq/storefront-kit/shared/format';

afterEach(cleanup);

// Mutated rather than re-mocked, because vi.mock is hoisted above anything a
// test could parameterise.
let product = {};
let freeShipping = true;
// Section headings the merchant may rename; empty means the storefront's own.
// On `brand`, exactly where ConfigProvider.shape puts section_copy: mocking
// them at the top level is how a crash on every product page passed here.
const sections = {};
const brand = { productShippingCopy: '', sections };

vi.mock('@sepetakhq/storefront-kit/config/ConfigProvider', () => ({
  useConfig: () => ({
    brand,
    freeShipping,
    freeShippingMinLabel: fmt(150000),
    // The real provider's helper, wired the same way, so these tests exercise
    // the actual withholding rule rather than a stand-in for it.
    copy: (s) => shippingCopy(s, { free_shipping_min: fmt(150000) }, freeShipping),
  }),
}));

vi.mock('@sepetakhq/storefront-kit/hooks/queries', () => ({
  useProduct: () => ({ data: product, isPending: false, isError: false, refetch: () => {} }),
}));

const cartCalls = [];
vi.mock('@sepetakhq/storefront-kit/cart/CartProvider', () => ({
  useCart: () => ({ add: (...args) => cartCalls.push(args), lines: [] }),
  MAX_QTY: 99,
}));

vi.mock('@sepetakhq/storefront-kit/ui/ToastProvider', () => ({
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
    for (const k of Object.keys(sections)) delete sections[k];
  });

  it('renders every section when each one has something to say', () => {
    brand.productShippingCopy = 'Dikirim dari Pekalongan.';
    withProduct({ material_spec: 'Voal 115×115 cm', care_copy: 'Cuci tangan.' });
    panel();

    expect(screen.getByText('Detail bahan & ukuran')).toBeTruthy();
    expect(screen.getByText('Cara perawatan')).toBeTruthy();
    expect(screen.getByText('Pengiriman')).toBeTruthy();
  });

  // The headings sit over merchant-written bodies, so they are the
  // merchant's too; a shop that sells food, not scarves, renames them.
  it('lets the shop rename the panel headings from its section copy', () => {
    brand.productShippingCopy = 'Dikirim dari Bandung.';
    sections.product_details_heading = 'Komposisi';
    sections.product_care_heading = 'Cara penyimpanan';
    sections.product_shipping_heading = 'Pengiriman & pengemasan';
    withProduct({ material_spec: 'Gula aren 250 g', care_copy: 'Simpan di tempat kering.' });
    panel();

    expect(screen.getByText('Komposisi')).toBeTruthy();
    expect(screen.getByText('Cara penyimpanan')).toBeTruthy();
    expect(screen.getByText('Pengiriman & pengemasan')).toBeTruthy();
    expect(screen.queryByText('Detail bahan & ukuran')).toBeNull();
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

  // The crash the browser found: stockNote is null for unlimited stock and
  // the page read `.color` off it. No note, no badge, and the page renders.
  it('renders an unlimited product at zero stock with no stock note', () => {
    withProduct({ unlimited_stock: true, stock: 0 });
    panel();

    expect(screen.queryByText(/Stok habis/)).toBeNull();
    expect(screen.queryByText(/Stok tersedia/)).toBeNull();
    expect(screen.queryByText(/PRE-ORDER/)).toBeNull();
    expect(screen.getByText('Voal Butter Daisy')).toBeTruthy();
  });
});

// The seeded towel: two sizes, two colours, three of four combinations sold,
// one of them sold out.
const towel = {
  slug: 'voal-butter-daisy',
  has_variants: true,
  price: 98000,
  price_max: 140000,
  stock: 40,
  options: [
    { name: 'Ukuran', values: ['70×140 cm', '50×100 cm'] },
    { name: 'Warna', values: ['Putih', 'Pasir'] },
  ],
  variants: [
    { id: 'a', options: { Ukuran: '70×140 cm', Warna: 'Putih' }, price: 140000, stock: 24, sold_out: false, image_id: 'img2' },
    { id: 'b', options: { Ukuran: '70×140 cm', Warna: 'Pasir' }, price: 140000, stock: 0, sold_out: true },
    { id: 'c', options: { Ukuran: '50×100 cm', Warna: 'Putih' }, price: 98000, stock: 16, sold_out: false },
  ],
  images: [
    { id: 'img1', url: 'https://cdn.test/1.jpg', alt: 'satu' },
    { id: 'img2', url: 'https://cdn.test/2.jpg', alt: 'dua' },
  ],
};

describe('ProductRoute variant picker', () => {
  afterEach(() => {
    cartCalls.length = 0;
  });

  it('asks for every axis before selling, and says "mulai" until then', () => {
    withProduct(towel);
    panel();
    expect(screen.getByRole('group', { name: 'Pilih Ukuran' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Pilih Warna' })).toBeTruthy();
    expect(screen.getByText('mulai')).toBeTruthy();
    const add = screen.getByRole('button', { name: 'Pilih varian dulu' });
    expect(add.disabled).toBe(true);
  });

  it('greys out a combination the shop does not sell and one that is sold out', () => {
    withProduct(towel);
    panel();
    fireEvent.click(screen.getByRole('button', { name: '50×100 cm' }));
    // 50×100 has no Pasir at all.
    expect(screen.getByRole('button', { name: 'Pasir (tidak tersedia)' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '70×140 cm' }));
    // 70×140 Pasir exists but is sold out.
    expect(screen.getByRole('button', { name: 'Pasir (stok habis)' }).disabled).toBe(true);
  });

  it('prices, stocks and adds the picked variant', () => {
    withProduct(towel);
    panel();
    fireEvent.click(screen.getByRole('button', { name: '50×100 cm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Putih' }));
    expect(screen.queryByText('mulai')).toBeNull();
    expect(screen.getAllByText(fmt(98000)).length).toBeGreaterThan(0);
    expect(screen.getByText(/16 pcs/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tambah ke Keranjang' }));
    expect(cartCalls).toHaveLength(1);
    expect(cartCalls[0][2]).toBe('c');
  });

  it('leads the gallery with the variant photo', () => {
    withProduct(towel);
    panel();
    fireEvent.click(screen.getByRole('button', { name: '70×140 cm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Putih' }));
    const imgs = screen.getAllByRole('img').filter((im) => im.getAttribute('src')?.includes('cdn.test'));
    expect(imgs[0].getAttribute('src')).toContain('/2.jpg');
  });

  it('changes nothing for a product sold as one thing', () => {
    withProduct({ has_variants: false, options: [], variants: [] });
    panel();
    expect(screen.queryByRole('group', { name: /^Pilih/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tambah ke Keranjang' }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Tambah ke Keranjang' }));
    expect(cartCalls[0][2]).toBeNull();
  });
});

// A product sold by weight counts grams: the stepper starts at qty_min, moves
// by qty_step, and the price reads per kg. Pieces stay a bare number.
describe('ProductRoute sale units', () => {
  afterEach(() => {
    cartCalls.length = 0;
  });

  it('prices per kg and steps the weight from its minimum', () => {
    withProduct({ unit: 'kg', qty_step: 100, qty_min: 500, stock: 5000 });
    panel();
    expect(screen.getByText('/kg')).toBeTruthy();
    expect(screen.getByText('0,5 kg')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kurangi jumlah' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Tambah jumlah' }));
    expect(screen.getByText('0,6 kg')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tambah ke Keranjang' }));
    expect(cartCalls[0][1]).toBe(600);
  });

  it('keeps pieces as before', () => {
    withProduct({ stock: 2 });
    panel();
    expect(screen.queryByText(/^\/(pcs|kg)$/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tambah jumlah' }));
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tambah jumlah' }).disabled).toBe(true);
  });
});
