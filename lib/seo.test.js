import { describe, expect, it } from 'vitest';

import { MAX_TITLE, pageName, pageTitle } from './seo.js';

// These cases mirror TestTitle in backend/internal/seo/meta_test.go. The server
// writes the first title a crawler sees; this writes the one a person sees
// after navigating. They should agree.
describe('pageTitle', () => {
  it('joins the page and the brand with an em dash', () => {
    expect(pageTitle('Katalog', 'Lily Alora')).toBe('Katalog — Lily Alora');
  });

  it('falls back to whichever half it has', () => {
    expect(pageTitle('', 'Lily Alora')).toBe('Lily Alora');
    expect(pageTitle('Katalog', '')).toBe('Katalog');
    expect(pageTitle('', '')).toBe('');
  });

  it('does not stutter when the page name is the brand', () => {
    expect(pageTitle('Lily Alora', 'Lily Alora')).toBe('Lily Alora');
    expect(pageTitle('lily alora', 'Lily Alora')).toBe('lily alora');
  });

  it('collapses whitespace from merchant copy', () => {
    expect(pageTitle('  Katalog\n\n', 'Lily Alora')).toBe('Katalog — Lily Alora');
  });

  it('truncates the page name and keeps the brand', () => {
    const long = 'Hijab Voal Premium Butter Yellow Ukuran 110 x 110 Sentimeter Persegi';
    const got = pageTitle(long, 'Lily Alora');

    expect(got.endsWith('— Lily Alora')).toBe(true);
    expect([...got].length).toBeLessThanOrEqual(MAX_TITLE);
    expect(got).toContain('…');
  });

  it('lets an over-long brand run over rather than chopping it', () => {
    const brand = 'Nama Toko Yang Panjang '.repeat(4);
    expect(pageTitle('Katalog', brand).startsWith('Katalog — ')).toBe(true);
  });

  // Emoji are two UTF-16 units each, so a .slice() on the raw string would cut
  // one in half and render a replacement character in the tab.
  it('cuts on code points, not UTF-16 units', () => {
    const got = pageTitle('🎁🎀🎊🎉✨💝🌸🌺🌷🌻'.repeat(8), 'Lily Alora');
    expect(got).not.toContain('�');
    expect([...got].length).toBeLessThanOrEqual(MAX_TITLE);
  });
});

describe('pageName', () => {
  it('names the routes a person navigates between', () => {
    expect(pageName('/katalog')).toBe('Katalog');
    expect(pageName('/tentang')).toBe('Tentang');
    expect(pageName('/keranjang')).toBe('Keranjang');
    expect(pageName('/checkout')).toBe('Checkout');
    expect(pageName('/lacak')).toBe('Lacak pesanan');
  });

  // Matches builder.home() in backend/internal/httpapi/seo.go. If these two
  // disagreed, React would overwrite the server's title the moment it mounted
  // -- a visible flicker, and two answers to one question.
  it('titles the home page by the short tagline, like the server does', () => {
    expect(pageName('/', { taglineShort: 'Pekalongan · Scarves' })).toBe('Pekalongan · Scarves');
    expect(pageName('/')).toBe('');
  });

  it('titles a product by its name', () => {
    expect(pageName('/produk/voal', { product: { name: 'Voal Butter Yellow' } })).toBe(
      'Voal Butter Yellow',
    );
  });

  // The server already wrote the right title. Returning a placeholder here
  // would flash it to something wrong and back while the query resolves.
  it('is empty while the product is still loading', () => {
    expect(pageName('/produk/voal')).toBe('');
    expect(pageName('/produk/voal', { product: null })).toBe('');
  });

  // The order page shows the buyer's name and city. Neither belongs in a
  // browser history entry, which outlives the session and is not access
  // controlled.
  it('never puts order details in the title', () => {
    expect(pageName('/pesanan/01JBXQ2K7M8N9P0Q1R2S3T4U5V')).toBe('Pesanan');
    expect(pageName('/track/01JBXQ2K7M8N9P0Q1R2S3T4U5V')).toBe('Pesanan');
  });

  it('leaves an unknown path to the brand alone', () => {
    expect(pageName('/tidak-ada')).toBe('');
  });
});
