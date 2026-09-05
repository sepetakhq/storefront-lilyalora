import { describe, expect, it } from 'vitest';

import { shape } from './ConfigProvider.jsx';

// The brand block is JSONB on the way out of Postgres, so every slice and
// every object in it arrives as null rather than as an empty one. These are
// the guards that keep a tenant who has set nothing from crashing the app --
// and, since a storefront bundle outlives the API it was built against, the
// guards that keep a new bundle working against an API that predates these
// fields.

describe('shape, on the brand identity fields', () => {
  it('maps a logo the merchant uploaded', () => {
    const out = shape({
      brand: { logo_image: { url: 'https://cdn.test/logo.png', srcset: '', alt: 'Lily' } },
    });

    expect(out.brand.logoImage.url).toBe('https://cdn.test/logo.png');
  });

  // Null, not {}. An empty object would read as a logo whose URL failed to
  // load, and the header would render a broken image instead of the wordmark.
  it('leaves an unset logo null', () => {
    expect(shape({ brand: {} }).brand.logoImage).toBeNull();
    expect(shape({}).brand.logoImage).toBeNull();
  });

  it('leaves an unset portrait null', () => {
    expect(shape({ brand: {} }).brand.aboutImage).toBeNull();
  });

  // A bundle newer than the API it talks to: no about copy in the payload,
  // and the page still has to render.
  it('is empty, not undefined, for an API that predates the about copy', () => {
    const out = shape({ brand: { wordmark_primary: 'Lily' } });

    expect(out.brand.aboutTitle).toBe('');
    expect(out.brand.aboutBody).toBe('');
  });

  // The about copy goes through the same substitution as the tagline, so a
  // story that mentions the threshold follows the merchant's actual setting.
  it('substitutes the threshold in the about copy', () => {
    const out = shape({
      brand: { about_body: 'Gratis ongkir di atas {free_shipping_min}.' },
      commerce: { free_shipping_min: 150000 },
    });

    expect(out.brand.aboutBody).toBe('Gratis ongkir di atas Rp 150.000.');
  });

  it('withholds an about promise the shop no longer offers', () => {
    const out = shape({
      brand: { about_body: 'Gratis ongkir di atas {free_shipping_min}.' },
      commerce: { free_shipping_min: 150000, free_shipping_disabled: true },
    });

    expect(out.brand.aboutBody).toBe('');
  });
});
