import { describe, expect, it } from 'vitest';

import {
  availableValues,
  galleryFor,
  initialSelection,
  isComplete,
  isPriceRange,
  lineKey,
  matchVariant,
  migrateCart,
  needsVariant,
  resolveVariant,
  select,
  variantLabel,
  withVariant,
} from './variants.js';

// The seeded towel: two sizes, two colours, three of four combinations sold,
// one of them sold out.
const v = (id, size, colour, extra = {}) => ({
  id,
  options: { Size: size, Colour: colour },
  price: 140000,
  stock: 5,
  sold_out: false,
  ...extra,
});
const towel = {
  id: 'p1',
  has_variants: true,
  price: 98000,
  price_max: 140000,
  options: [
    { name: 'Size', values: ['70×140 cm', '50×100 cm'] },
    { name: 'Colour', values: ['White', 'Sand'] },
  ],
  variants: [
    v('a', '70×140 cm', 'White', { image_id: 'img2' }),
    v('b', '70×140 cm', 'Sand', { stock: 0, sold_out: true }),
    v('c', '50×100 cm', 'White', { price: 98000 }),
  ],
  images: [{ id: 'img1' }, { id: 'img2' }, { id: 'img3' }],
};

describe('lineKey', () => {
  it('keys on product then variant, and accepts both spellings', () => {
    expect(lineKey({ productId: 'p', variantId: 'v' })).toBe('p:v');
    expect(lineKey({ productId: 'p', variantId: null })).toBe('p:');
    expect(lineKey({ product_id: 'p', variant_id: 'v' })).toBe('p:v');
  });
});

describe('withVariant', () => {
  it('overlays the variant price, stock and sold_out so the product helpers keep working', () => {
    const s = withVariant(towel, towel.variants[1]);
    expect(s.price).toBe(140000);
    expect(s.stock).toBe(0);
    expect(s.sold_out).toBe(true);
    expect(s.variant.id).toBe('b');
    expect(withVariant(towel, null)).toBe(towel);
    expect(resolveVariant(towel, 'c').id).toBe('c');
    expect(resolveVariant(towel, 'zzz')).toBeNull();
  });
});

describe('matchVariant / isComplete', () => {
  it('finds the one variant for a complete selection and nothing for a partial one', () => {
    expect(matchVariant(towel.variants, { Size: '70×140 cm', Colour: 'Sand' }).id).toBe('b');
    expect(matchVariant(towel.variants, { Size: '70×140 cm' })).toBeNull();
    expect(matchVariant(towel.variants, { Size: '50×100 cm', Colour: 'Sand' })).toBeNull();
    expect(isComplete(towel.options, { Size: 'x' })).toBe(false);
    expect(isComplete(towel.options, { Size: 'x', Colour: 'y' })).toBe(true);
  });
});

describe('availableValues', () => {
  it('greys out a combination the shop does not sell, and one that is sold out', () => {
    // Nothing else picked: Sand exists in one size only, and that one is
    // sold out, so Sand as a colour is sold out.
    expect(availableValues(towel, 'Colour', {})).toEqual([
      { value: 'White', exists: true, soldOut: false },
      { value: 'Sand', exists: true, soldOut: true },
    ]);
    // 70×140 picked: Sand exists but is sold out.
    expect(availableValues(towel, 'Colour', { Size: '70×140 cm' })).toEqual([
      { value: 'White', exists: true, soldOut: false },
      { value: 'Sand', exists: true, soldOut: true },
    ]);
    // 50×100 picked: Sand does not exist at all.
    expect(availableValues(towel, 'Colour', { Size: '50×100 cm' })).toEqual([
      { value: 'White', exists: true, soldOut: false },
      { value: 'Sand', exists: false, soldOut: false },
    ]);
    expect(availableValues(towel, 'Nope', {})).toEqual([]);
  });
});

describe('initialSelection / select', () => {
  it('preselects single-value axes and a lone variant, guesses nothing else', () => {
    expect(initialSelection(towel)).toEqual({});
    expect(initialSelection({ has_variants: false })).toEqual({});
    const one = { has_variants: true, options: towel.options, variants: [towel.variants[2]] };
    expect(initialSelection(one)).toEqual({ Size: '50×100 cm', Colour: 'White' });
    const single = {
      has_variants: true,
      options: [{ name: 'Size', values: ['M'] }, { name: 'Colour', values: ['A', 'B'] }],
      variants: [v('x', 'M', 'A'), v('y', 'M', 'B')],
    };
    expect(initialSelection(single)).toEqual({ Size: 'M' });
  });
  it('drops a pick on another axis that no longer combines', () => {
    const sel = select(towel, { Colour: 'Sand' }, 'Size', '50×100 cm');
    expect(sel).toEqual({ Size: '50×100 cm' });
    const keep = select(towel, { Colour: 'White' }, 'Size', '50×100 cm');
    expect(keep).toEqual({ Size: '50×100 cm', Colour: 'White' });
  });
});

describe('variantLabel / isPriceRange / galleryFor / needsVariant', () => {
  it('labels in axis order', () => {
    expect(variantLabel(towel, towel.variants[1])).toBe('70×140 cm / Sand');
    expect(variantLabel(towel, null)).toBe('');
    expect(variantLabel({ options: [] }, { options: { A: '1' } })).toBe('1');
  });
  it('has a range only when the dearest variant costs more than the cheapest', () => {
    expect(isPriceRange(towel)).toBe(true);
    expect(isPriceRange({ ...towel, price_max: 98000 })).toBe(false);
    expect(isPriceRange({ has_variants: false, price: 1, price_max: 5 })).toBe(false);
  });
  it('moves the variant photo first and leaves the gallery alone otherwise', () => {
    expect(galleryFor(towel.images, towel.variants[0]).map((i) => i.id)).toEqual(['img2', 'img1', 'img3']);
    expect(galleryFor(towel.images, towel.variants[1])).toBe(towel.images);
    expect(galleryFor(towel.images, { image_id: 'deleted' })).toBe(towel.images);
    expect(galleryFor(undefined, null)).toEqual([]);
  });
  it('flags an item without a variant on a product that has them', () => {
    expect(needsVariant({ variantId: null }, towel)).toBe(true);
    expect(needsVariant({ variantId: 'a' }, towel)).toBe(false);
    expect(needsVariant({ variantId: null }, { has_variants: false })).toBe(false);
  });
});

describe('migrateCart', () => {
  it('keeps a v2 cart with variantId null, reads v3 as-is, drops anything else', () => {
    expect(migrateCart({ v: 2, items: [{ productId: 'p', slug: 's', qty: 2 }] })).toEqual([
      { productId: 'p', slug: 's', qty: 2, variantId: null },
    ]);
    const v3 = [{ productId: 'p', slug: 's', qty: 1, variantId: 'v' }];
    expect(migrateCart({ v: 3, items: v3 })).toBe(v3);
    expect(migrateCart({ v: 1, items: [] })).toBeNull();
    expect(migrateCart(null)).toBeNull();
    expect(migrateCart({ v: 3 })).toBeNull();
  });
});
