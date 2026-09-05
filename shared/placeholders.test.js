import { describe, expect, it } from 'vitest';

import {
  PLACEHOLDERS,
  placeholderProblem,
  placeholdersIn,
  unknownPlaceholders,
} from './placeholders.js';

import { interpolate } from './format.js';

describe('placeholdersIn', () => {
  it('finds the tokens in a sentence', () => {
    expect(placeholdersIn('Gratis ongkir min {free_shipping_min}.')).toEqual([
      'free_shipping_min',
    ]);
  });

  it('collapses duplicates', () => {
    expect(placeholdersIn('{a} lalu {a} lagi')).toEqual(['a']);
  });

  it('is empty for copy with no tokens', () => {
    expect(placeholdersIn('Koleksi perdana telah hadir')).toEqual([]);
    expect(placeholdersIn('')).toEqual([]);
    expect(placeholdersIn(undefined)).toEqual([]);
  });

  // Braces a merchant typed as punctuation are not tokens. Only \w+ counts,
  // which is the same pattern interpolate substitutes on.
  it('ignores braces that are not tokens', () => {
    expect(placeholdersIn('harga {} atau { spasi }')).toEqual([]);
  });
});

describe('unknownPlaceholders', () => {
  it('accepts the one that exists', () => {
    expect(unknownPlaceholders('Gratis ongkir min {free_shipping_min}.')).toEqual([]);
  });

  it('catches a typo', () => {
    expect(unknownPlaceholders('Gratis ongkir min {free_shiping_min}.')).toEqual([
      'free_shiping_min',
    ]);
  });

  // The syntax looks like a template language, so a merchant will reasonably
  // guess at names that were never implemented.
  it('catches an invented name', () => {
    expect(unknownPlaceholders('Dikirim dari {kota_asal}.')).toEqual(['kota_asal']);
  });

  it('reports every unknown token, not just the first', () => {
    expect(unknownPlaceholders('{satu} dan {dua} dan {free_shipping_min}')).toEqual([
      'satu',
      'dua',
    ]);
  });
});

describe('placeholderProblem', () => {
  it('is null for copy that is fine', () => {
    expect(placeholderProblem('Gratis ongkir min {free_shipping_min}.')).toBeNull();
    expect(placeholderProblem('Koleksi perdana telah hadir')).toBeNull();
  });

  // Both halves: a message naming only the mistake leaves the merchant
  // guessing at the spelling, which is how the typo happened.
  it('names what was written and what exists', () => {
    const msg = placeholderProblem('Gratis ongkir min {free_shiping_min}.');
    expect(msg).toContain('{free_shiping_min}');
    expect(msg).toContain('{free_shipping_min}');
  });
});

// The reason this validation exists at all. If interpolate blanked an unknown
// token the mistake would be invisible; because it passes the token through,
// the mistake is loud on the storefront and silent everywhere a merchant
// looks. Pinned here so nobody "fixes" interpolate into hiding it.
describe('the failure mode being guarded against', () => {
  it('renders an unknown token literally to buyers', () => {
    const out = interpolate('Gratis ongkir min {free_shiping_min}.', {
      free_shipping_min: 'Rp 150.000',
    });
    expect(out).toBe('Gratis ongkir min {free_shiping_min}.');
  });
});

// The backoffice renders this list; an entry with no wording would render an
// empty bullet under six fields.
describe('the published list', () => {
  it('gives every placeholder a name and a description', () => {
    expect(PLACEHOLDERS.length).toBeGreaterThan(0);
    for (const p of PLACEHOLDERS) {
      expect(p.name).toBeTruthy();
      expect(p.label).toBeTruthy();
    }
  });
});
