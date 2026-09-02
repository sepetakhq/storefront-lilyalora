import { describe, expect, it } from 'vitest';

import { listPhrase, missingFields } from './CheckoutRoute.jsx';

const empty = { customer_name: '', contact: '', address: '', city: '' };
const full = {
  customer_name: 'Siti',
  contact: 'siti@buyer.test',
  address: 'Jl. Melati 12',
  city: 'Pekalongan',
};

// The first submit of an empty form used to name three fields and leave the
// contact out, so the buyer fixed those three, submitted again, and only then
// met a fourth requirement.
describe('missingFields', () => {
  it('names every empty field at once, contact included', () => {
    const got = missingFields({
      form: empty,
      liveShipping: false,
      destination: null,
      contactLabel: 'Email',
    });
    expect(got).toEqual(['nama', 'email', 'alamat', 'kota']);
  });

  it('is empty when the form is complete', () => {
    expect(
      missingFields({ form: full, liveShipping: false, destination: null, contactLabel: 'Email' }),
    ).toEqual([]);
  });

  // Live rates replace the free-text city with a picked destination, so the
  // check and the label both change.
  it('asks for a picked destination under live rates', () => {
    expect(
      missingFields({ form: full, liveShipping: true, destination: null, contactLabel: 'Email' }),
    ).toEqual(['tujuan pengiriman']);
    expect(
      missingFields({
        form: { ...full, city: '' },
        liveShipping: true,
        destination: { ref: 'x' },
        contactLabel: 'Email',
      }),
    ).toEqual([]);
  });

  it('follows the label of whichever contact channel is configured', () => {
    const got = missingFields({
      form: empty,
      liveShipping: false,
      destination: null,
      contactLabel: 'Nomor WhatsApp',
    });
    expect(got).toContain('nomor whatsapp');
  });

  it('treats whitespace as empty', () => {
    expect(
      missingFields({
        form: { customer_name: '  ', contact: ' ', address: '\t', city: ' ' },
        liveShipping: false,
        destination: null,
        contactLabel: 'Email',
      }),
    ).toHaveLength(4);
  });
});

describe('listPhrase', () => {
  it('joins the Indonesian way, with a serial "dan" and no comma before it', () => {
    expect(listPhrase(['nama', 'alamat', 'kota'])).toBe('nama, alamat dan kota');
    expect(listPhrase(['nama', 'kota'])).toBe('nama dan kota');
    expect(listPhrase(['kota'])).toBe('kota');
    expect(listPhrase([])).toBe('');
  });
});
