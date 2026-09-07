import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import ProductCard from './ProductCard.jsx';

afterEach(cleanup);

function product(over) {
  return {
    slug: 'square-butter-daisy',
    name: 'Square Butter Daisy',
    category_label: 'New Hope Summer',
    image: 'https://cdn.test/p_800.v1.webp',
    image_srcset: '',
    price: 72000,
    compare_at_price: 89979,
    on_sale: true,
    badge: 'Diskon 20%',
    preorder: true,
    ...over,
  };
}

function card(p, props) {
  const { container } = render(
    <MemoryRouter>
      <ProductCard p={p} {...props} />
    </MemoryRouter>,
  );
  return container;
}

/** The chips' shared parent, or null when neither chip rendered. */
function badgeRow(container) {
  const chip = container.querySelector('span[style*="border-radius: 999px"]');
  return chip ? chip.parentElement : null;
}

describe('ProductCard badges', () => {
  // The regression: two absolutely positioned chips pinned to opposite corners
  // painted over each other on a phone, because neither could see the other.
  // They share one wrapping flex row now, so a narrow card stacks them.
  it('lays a discounted pre-order out as one wrapping row', () => {
    const row = badgeRow(card(product()));

    expect(row.style.display).toBe('flex');
    expect(row.style.flexWrap).toBe('wrap');
    // Pinned across the top of the photo, not to one corner of it.
    expect(row.style.left).toBe('12px');
    expect(row.style.right).toBe('12px');

    expect([...row.children].map((c) => c.textContent)).toEqual(['Diskon 20%', 'PRE-ORDER']);
  });

  // Whichever chip is present keeps the corner it has always had: the offer on
  // the left, the delivery promise pushed to the far edge of its own line.
  it('keeps each chip on its own side', () => {
    const both = badgeRow(card(product()));
    expect(both.children[0].style.marginLeft).toBe('');
    expect(both.children[1].style.marginLeft).toBe('auto');

    cleanup();
    const alone = badgeRow(card(product({ badge: null })));
    expect(alone.children).toHaveLength(1);
    expect(alone.children[0].style.marginLeft).toBe('auto');
  });

  // A chip that broke mid-word inside its own pill would read as a fault, so
  // the row wraps between chips and never through one.
  it('never breaks a chip across lines', () => {
    const row = badgeRow(card(product()));
    for (const chip of row.children) {
      expect(chip.style.whiteSpace).toBe('nowrap');
      expect(chip.style.flexShrink).toBe('0');
      expect(chip.style.maxWidth).toBe('100%');
    }
  });

  it('renders no row at all when there is nothing to say', () => {
    expect(badgeRow(card(product({ badge: null, preorder: false })))).toBeNull();
  });

  // `related` withholds marketing but not the delivery window: a buyer coming
  // from "Kamu mungkin suka" is owed it before they add to cart.
  it('drops the offer but keeps the pre-order chip in the related variant', () => {
    const row = badgeRow(card(product(), { variant: 'related' }));

    expect([...row.children].map((c) => c.textContent)).toEqual(['PRE-ORDER']);
  });
});
