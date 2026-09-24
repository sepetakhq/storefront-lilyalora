import { describe, expect, it } from 'vitest';

import { DEFAULT_LABELS, campaignHeadline, heroCta, navLabel, originLine, sectionText, whatsappText } from './copy.js';

describe('sectionText', () => {
  it("uses the merchant's label when set", () => {
    expect(sectionText({ related_heading: 'Pasangkan dengan' }, 'related_heading')).toBe('Pasangkan dengan');
  });
  it('trims the merchant label', () => {
    expect(sectionText({ cats_heading: '  Koleksi  ' }, 'cats_heading')).toBe('Koleksi');
  });
  it('falls back to the default when blank, whitespace or missing', () => {
    expect(sectionText({ cats_heading: '' }, 'cats_heading')).toBe(DEFAULT_LABELS.cats_heading);
    expect(sectionText({ cats_heading: '   ' }, 'cats_heading')).toBe(DEFAULT_LABELS.cats_heading);
    expect(sectionText(undefined, 'story_cta')).toBe('Baca cerita kami');
  });
  it('gives nothing for a key the template does not draw', () => {
    expect(sectionText({}, 'nope')).toBe('');
  });
});

describe('originLine', () => {
  it('joins the prefix and the city', () => {
    expect(originLine({ origin_city: 'Solo', sections: {} })).toBe('dikirim dari Solo');
    expect(originLine({ origin_city: 'Solo', sections: { origin_prefix: 'Dari' } })).toBe('Dari Solo');
  });
  it('is empty without a city', () => {
    expect(originLine({ origin_city: '', sections: { origin_prefix: 'Dari' } })).toBe('');
    expect(originLine({ origin_city: '  ' })).toBe('');
    expect(originLine(undefined)).toBe('');
  });
});

describe('navLabel', () => {
  it("uses the merchant's nav label for the path", () => {
    expect(navLabel([{ path: '/katalog', label: 'Koleksi' }], '/katalog', 'Katalog')).toBe('Koleksi');
  });
  it('falls back without an entry or with a blank label', () => {
    expect(navLabel([], '/katalog', 'Katalog')).toBe('Katalog');
    expect(navLabel([{ path: '/katalog', label: ' ' }], '/katalog', 'Katalog')).toBe('Katalog');
    expect(navLabel(undefined, '/katalog', 'Katalog')).toBe('Katalog');
  });
});

describe('field fallbacks', () => {
  it('whatsappText', () => {
    expect(whatsappText({ whatsapp_text: 'Tanya kami' })).toBe('Tanya kami');
    expect(whatsappText({ whatsapp_text: '  ' })).toBe('Chat WhatsApp');
    expect(whatsappText({})).toBe('Chat WhatsApp');
  });
  it('heroCta', () => {
    expect(heroCta({ cta: 'Lihat koleksi' })).toBe('Lihat koleksi');
    expect(heroCta({ cta: '' })).toBe('Belanja sekarang');
  });
});

describe('campaignHeadline', () => {
  it("prefers the merchant's headline, trimmed", () => {
    expect(campaignHeadline({ headline: ' Lebaran sale ', discount_type: 'percentage', discount_value: 20 })).toBe('Lebaran sale');
  });
  it('words the discount without one', () => {
    expect(campaignHeadline({ headline: ' ', discount_type: 'percentage', discount_value: 20 })).toBe('Diskon 20%');
    expect(campaignHeadline({ discount_type: 'fixed', discount_value: 15000 })).toMatch(/^Potongan Rp\s?15\.000$/);
  });
});
