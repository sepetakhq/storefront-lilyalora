import { describe, expect, it } from 'vitest';

import { estimateShipping, listPhrase, missingFields } from './CheckoutRoute.jsx';

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

// The summary is only an estimate, but it has to mirror the server's rule --
// the draft on the next screen is the one that charges, and a buyer who sees
// "Gratis" and then pays 12000 has been told two different prices.
describe('estimateShipping', () => {
  const courier = { cost: 12000 };

  it('waives the charge at the threshold', () => {
    expect(estimateShipping(150000, courier, { enabled: true, min: 150000 })).toBe(0);
  });

  it('charges just below it', () => {
    expect(estimateShipping(149999, courier, { enabled: true, min: 150000 })).toBe(12000);
  });

  it('charges at any subtotal once the offer is off', () => {
    expect(estimateShipping(10000000, courier, { enabled: false, min: 150000 })).toBe(12000);
  });

  // A threshold of zero is the case a flag has to beat: it means every order
  // ships free, so there is no number that could stand for "no offer".
  it('charges with the offer off even where the threshold is zero', () => {
    expect(estimateShipping(500000, courier, { enabled: false, min: 0 })).toBe(12000);
  });

  it('is zero before a courier is chosen', () => {
    expect(estimateShipping(500000, null, { enabled: false, min: 150000 })).toBe(0);
  });
});
