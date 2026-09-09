import { describe, expect, it } from 'vitest';

import {
  betterAutomaticNote,
  normalizeVoucherInput,
  voucherLabel,
  voucherNotes,
} from './voucher.js';

// The rule itself is tested once, in src/shared/voucher.test.js, against the
// fixture the Go suite reads too. What is worth checking here is only that
// checkout still reaches it under the name it imports.
describe('normalizeVoucherInput', () => {
  it('is the shared code rule', () => {
    expect(normalizeVoucherInput(' hemat 15! ')).toBe('HEMAT15');
    expect(normalizeVoucherInput('HEMAT​15')).toBe('HEMAT15');
  });
});

describe('voucherNotes', () => {
  // A buyer who never typed a code must see the summary exactly as it was.
  it('is empty when no code was sent', () => {
    expect(voucherNotes({})).toEqual([]);
    expect(voucherNotes({ voucher: null })).toEqual([]);
    expect(voucherNotes(undefined)).toEqual([]);
  });

  // The discount already has a row of its own. A second one would print the
  // same rupiah twice and make the footer look as though it did not add up.
  it('says nothing extra about a voucher that simply worked', () => {
    expect(voucherNotes({ voucher: { code: 'HEMAT15', applied: true, amount: 20000 } })).toEqual([]);
  });

  // The wording of a refusal belongs to the server, which is the only side
  // that knows the promotion and the cart it was measured against. A table
  // here would go stale the moment the backend learns a new reason.
  it('renders the server message verbatim for a refused code', () => {
    const notes = voucherNotes({
      voucher: {
        code: 'HEMAT15',
        applied: false,
        reason: 'requirements_not_met',
        message: 'Kode HEMAT15 berlaku mulai belanja Rp 150.000.',
      },
    });
    expect(notes).toEqual([
      { tone: 'warn', text: 'Kode HEMAT15 berlaku mulai belanja Rp 150.000.' },
    ]);
  });

  // A reason the server adds later must still say something, without a deploy
  // here. It never happens with the current backend, which always sends copy.
  it('falls back to a plain sentence when the server sent no message', () => {
    const notes = voucherNotes({ voucher: { code: 'HEMAT15', applied: false, reason: 'baru' } });
    expect(notes[0].tone).toBe('warn');
    expect(notes[0].text).toBeTruthy();
  });

  it('carries the disclosure when the shop promo was bigger', () => {
    const notes = voucherNotes({
      voucher: {
        code: 'HEMAT15',
        applied: true,
        amount: 20000,
        outbid: 50000,
        outbid_name: 'Promo Lebaran',
      },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0].tone).toBe('muted');
  });
});

describe('voucherLabel', () => {
  // The buyer typed the code; the campaign name is the merchant's word for
  // the same thing, and only one of the two means anything to them.
  it('labels the row with the code when a voucher applied', () => {
    expect(voucherLabel({ voucher: { code: 'HEMAT15', applied: true } }, 'Diskon')).toBe(
      'Kode HEMAT15',
    );
  });

  it('leaves the row alone otherwise', () => {
    const fallback = 'Diskon Promo Lebaran';
    expect(voucherLabel({}, fallback)).toBe(fallback);
    expect(voucherLabel({ voucher: { code: 'X', applied: false } }, 'Diskon')).toBe('Diskon');
  });
});

describe('betterAutomaticNote', () => {
  // The one case where typing a code left the buyer worse off than typing
  // nothing. Finding that out from the total instead of from a sentence is the
  // outcome the disclosure exists to prevent.
  it('names the promotion and the code that displaced it', () => {
    const note = betterAutomaticNote({
      applied: true,
      code: 'HEMAT15',
      amount: 20000,
      outbid: 50000,
      outbid_name: 'Promo Lebaran',
    });
    expect(note).toContain('Promo Lebaran');
    expect(note).toContain('HEMAT15');
  });

  it('says nothing when the voucher was the better of the two', () => {
    expect(
      betterAutomaticNote({ applied: true, code: 'X', amount: 50000, outbid: 20000 }),
    ).toBeNull();
  });

  // Strictly greater, matching the server: an equal promotion gave up nothing.
  it('says nothing when the two were equal', () => {
    expect(
      betterAutomaticNote({ applied: true, code: 'X', amount: 20000, outbid: 20000 }),
    ).toBeNull();
  });

  it('says nothing when there was no automatic promotion at all', () => {
    expect(betterAutomaticNote({ applied: true, code: 'X', amount: 20000 })).toBeNull();
  });

  it('says nothing about a code that never applied', () => {
    expect(betterAutomaticNote({ applied: false, code: 'X', amount: 0, outbid: 50000 })).toBeNull();
  });
});
