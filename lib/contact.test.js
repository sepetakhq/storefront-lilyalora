import { describe, expect, it } from 'vitest';

import { contactField, normalizeContact, validateContact } from './contact.js';

// A blank field and a mistyped one are different problems and used to share
// one message. Submitting an empty checkout reported "Alamat email tidak
// valid." — telling the buyer to correct something they had not written.
describe('validateContact', () => {
  it('says the field is empty when it is empty', () => {
    for (const raw of ['', '   ', null, undefined]) {
      expect(validateContact('email', raw)).toBe('Email belum diisi.');
      expect(validateContact('whatsapp', raw)).toBe('Nomor WhatsApp belum diisi.');
    }
  });

  it('still says invalid when something unusable was typed', () => {
    expect(validateContact('email', 'bukan-email')).toBe('Alamat email tidak valid.');
    // normalizePhone returns an empty string for input it cannot parse, so
    // judging emptiness on the normalised value would call this blank too.
    expect(validateContact('whatsapp', 'abcdef')).toBe('Nomor WhatsApp tidak valid.');
    expect(validateContact('whatsapp', '0812')).toBe('Nomor WhatsApp tidak valid.');
  });

  it('accepts what the server would', () => {
    expect(validateContact('email', ' Siti@Buyer.TEST ')).toBeNull();
    expect(validateContact('whatsapp', '0856 4123 2507')).toBeNull();
  });

  it('names the field the way the input is labelled', () => {
    expect(validateContact('email', '')).toContain(contactField('email').label);
    expect(validateContact('whatsapp', '')).toContain(contactField('whatsapp').label);
  });
});

describe('normalizeContact', () => {
  it('lowercases an email and trims it', () => {
    expect(normalizeContact('email', '  Siti@Buyer.TEST ')).toBe('siti@buyer.test');
  });
});
