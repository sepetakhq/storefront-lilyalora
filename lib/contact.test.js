import { describe, expect, it } from 'vitest';

import {
  contactField,
  normalizeContact,
  normalizePhone,
  validateContact,
  validatePhone,
} from './contact.js';

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

// The courier's number, which is a different field from the contact even when
// both hold a phone. Nothing is ever sent to it, so its copy says "Nomor HP"
// rather than naming WhatsApp — mirroring draftPhone on the server.
describe('validatePhone', () => {
  it('separates blank from mistyped, the way validateContact does', () => {
    expect(validatePhone('')).toBe('Nomor HP belum diisi.');
    expect(validatePhone('   ')).toBe('Nomor HP belum diisi.');
    expect(validatePhone('abcdef')).toBe('Nomor HP tidak valid.');
    expect(validatePhone('0812')).toBe('Nomor HP tidak valid.');
  });

  it('never names a channel the buyer is not using', () => {
    expect(validatePhone('')).not.toContain('WhatsApp');
    expect(validatePhone('abcdef')).not.toContain('WhatsApp');
  });

  it('accepts what the server would', () => {
    expect(validatePhone('08123456789')).toBeNull();
    expect(validatePhone('62 812 3456 789')).toBeNull();
    expect(validatePhone('628123456789')).toBeNull();
  });

  // One shape reaches the database whatever the buyer typed, so the backoffice
  // never has to guess which of the three it is looking at.
  it('reduces every spelling of one number to the same digits', () => {
    const want = '628123456789';
    expect(normalizePhone('08123456789')).toBe(want);
    expect(normalizePhone('62 812 3456 789')).toBe(want);
    expect(normalizePhone('628123456789')).toBe(want);
  });
});
