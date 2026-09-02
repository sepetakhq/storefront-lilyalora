import { describe, expect, it } from 'vitest';

import {
  defaultOption,
  destinationLines,
  destinationSummary,
  isStillOffered,
  isUnserved,
  matchRange,
  splitEtd,
  unservedAlternatives,
  weightInKg,
} from './shipping.js';

describe('isUnserved', () => {
  // "No courier goes there" and "the provider is having a bad minute" need
  // opposite advice, so the two must never be confused: one says pick
  // somewhere else, the other says wait and retry.
  it('recognises the refusal', () => {
    expect(isUnserved({ status: 409, code: 'destination_unserved' })).toBe(true);
  });

  it('rejects a retryable outage', () => {
    expect(isUnserved({ status: 503, code: 'rates_unavailable' })).toBe(false);
  });

  it('rejects some other conflict', () => {
    // 409 alone is not enough: no_routes is also a conflict and carries no
    // alternatives to offer.
    expect(isUnserved({ status: 409, code: 'no_routes' })).toBe(false);
  });

  it('rejects nothing at all', () => {
    expect(isUnserved(null)).toBe(false);
    expect(isUnserved(undefined)).toBe(false);
  });
});

describe('unservedAlternatives', () => {
  it('returns the places that do resolve', () => {
    const err = { details: { alternatives: [{ ref: 'v1' }, { ref: 'v2' }] } };
    expect(unservedAlternatives(err)).toHaveLength(2);
  });

  // details is an open map filled by the server. An older build sends nothing
  // there, and mapping over undefined inside an error path would replace the
  // explanation with a blank screen.
  it('survives a response with no details', () => {
    expect(unservedAlternatives({ status: 409 })).toEqual([]);
    expect(unservedAlternatives({ details: {} })).toEqual([]);
    expect(unservedAlternatives({ details: { alternatives: 'nope' } })).toEqual([]);
    expect(unservedAlternatives(null)).toEqual([]);
  });
});

const kemayoran = {
  ref: '10610',
  label: 'KEMAYORAN, JAKARTA PUSAT, DKI JAKARTA, 10610',
  subdistrict: 'Kebon Kosong',
  district: 'Kemayoran',
  city: 'Jakarta Pusat',
  province: 'DKI Jakarta',
  zip_code: '10610',
};

describe('destinationLines', () => {
  it('puts the narrow levels first', () => {
    // What the buyer is looking for goes on top; the wide half is there to
    // tell two identically named villages apart.
    expect(destinationLines(kemayoran)).toEqual({
      primary: 'Kebon Kosong, Kemayoran',
      secondary: 'Jakarta Pusat · DKI Jakarta · 10610',
    });
  });

  it('falls through when a row resolves only to a city', () => {
    // Not every result has four levels, and a blank primary line reads as a
    // broken result rather than a coarse one.
    expect(destinationLines({ city: 'Pekalongan', province: 'Jawa Tengah' })).toEqual({
      primary: 'Pekalongan, Jawa Tengah',
      secondary: '',
    });
  });

  it('falls back to the provider label when nothing is structured', () => {
    expect(destinationLines({ label: 'SOMEWHERE' }).primary).toBe('SOMEWHERE');
  });

  it('survives an absent destination', () => {
    expect(destinationLines(null)).toEqual({ primary: '', secondary: '' });
  });
});

describe('destinationSummary', () => {
  it('joins both halves onto one line', () => {
    expect(destinationSummary(kemayoran)).toBe(
      'Kebon Kosong, Kemayoran · Jakarta Pusat · DKI Jakarta · 10610',
    );
  });
});

describe('matchRange', () => {
  it('finds a match regardless of case', () => {
    expect(matchRange('Kebon Kosong', 'kosong')).toEqual({ start: 6, end: 12 });
  });

  it('treats the query as literal text', () => {
    // The buyer typed letters, not a pattern. A stray "." must not match
    // everything.
    expect(matchRange('Kemayoran', '.')).toBeNull();
  });

  it('returns null when this line does not contain the match', () => {
    // Legitimate: the provider matches on parts of the label a line does not
    // show, such as a postcode.
    expect(matchRange('Kemayoran', '10610')).toBeNull();
  });

  it('returns null for an empty query', () => {
    expect(matchRange('Kemayoran', '  ')).toBeNull();
  });
});

describe('weightInKg', () => {
  it('rounds up to a whole kilogram', () => {
    // What the server quotes at and what couriers bill: a 300g parcel and a
    // 900g parcel cost the same.
    expect(weightInKg(1)).toBe('1');
    expect(weightInKg(999)).toBe('1');
    expect(weightInKg(1000)).toBe('1');
    expect(weightInKg(1001)).toBe('2');
    expect(weightInKg(2600)).toBe('3');
  });

  it('shows nothing rather than zero for a missing weight', () => {
    for (const v of [0, -1, null, undefined, 'abc']) {
      expect(weightInKg(v)).toBe('');
    }
  });
});

describe('splitEtd', () => {
  it('separates the numeral from the unit', () => {
    // The list leads on speed, so the number is set large and the unit small.
    expect(splitEtd('2-3 hari')).toEqual({ value: '2-3', unit: 'hari' });
    expect(splitEtd('1 day')).toEqual({ value: '1', unit: 'day' });
  });

  it('closes up a spaced range', () => {
    expect(splitEtd('1 - 2 HARI')).toEqual({ value: '1-2', unit: 'HARI' });
  });

  it('passes anything unparseable through whole', () => {
    // Better an odd-looking label than a mangled one: the server normalises
    // the shape but deliberately not the language.
    expect(splitEtd('besok sampai')).toEqual({ value: '', unit: 'besok sampai' });
  });

  it('handles an empty estimate', () => {
    expect(splitEtd('')).toEqual({ value: '', unit: '' });
    expect(splitEtd(null)).toEqual({ value: '', unit: '' });
  });
});

describe('defaultOption', () => {
  const options = [
    { quote_id: 'a', cost: 32000 },
    { quote_id: 'b', cost: 18000 },
    { quote_id: 'c', cost: 21000 },
  ];

  it('lands on the cheapest, not the first', () => {
    // The merchant's order is their ranking and stays in the list, but
    // pre-selecting the express service would charge an inattentive buyer for
    // a choice they never made.
    expect(defaultOption(options).quote_id).toBe('b');
  });

  it('keeps merchant order on a tie, so the choice is stable', () => {
    const tied = [
      { quote_id: 'a', cost: 18000 },
      { quote_id: 'b', cost: 18000 },
    ];
    expect(defaultOption(tied).quote_id).toBe('a');
  });

  it('returns null when there is nothing to choose', () => {
    expect(defaultOption([])).toBeNull();
    expect(defaultOption(undefined)).toBeNull();
  });
});

describe('isStillOffered', () => {
  const options = [{ quote_id: 'a' }, { quote_id: 'b' }];

  it('recognises a quote that is still on the list', () => {
    expect(isStillOffered(options, 'b')).toBe(true);
  });

  it('rejects one from a previous list', () => {
    // A quote id from before the cart changed would be refused at the draft
    // step; catching it here makes the buyer re-pick while they are still
    // looking at the options.
    expect(isStillOffered(options, 'gone')).toBe(false);
  });

  it('rejects nothing chosen', () => {
    expect(isStillOffered(options, '')).toBe(false);
    expect(isStillOffered(options, null)).toBe(false);
  });
});
