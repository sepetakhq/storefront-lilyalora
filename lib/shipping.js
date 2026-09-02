// Presentation rules for live shipping rates.
//
// Nothing here computes a price or a weight. The server quotes, stores and
// charges; the rate list is shown from what it returned, and the only reason
// this module exists is that the provider's own strings are not presentable as
// they arrive — a location label is a wall of commas, and an ETA is whatever
// each courier felt like writing.

/**
 * The two halves of a destination, for a two-line list item.
 *
 * An Indonesian address resolves four levels deep, so the provider's label
 * reads "KEMAYORAN, JAKARTA PUSAT, DKI JAKARTA, 10610" — true, and unreadable
 * in a dropdown of ten. The narrow half goes on top because that is what the
 * buyer is looking for; the wide half disambiguates it.
 */
export function destinationLines(d) {
  if (!d) return { primary: '', secondary: '' };

  const narrow = [d.subdistrict, d.district].filter(Boolean);
  const wide = [d.city, d.province].filter(Boolean);

  // Fall back through the levels rather than showing an empty line: not every
  // row resolves all four, and a blank primary looks like a broken result.
  const primary = narrow.length > 0 ? narrow.join(', ') : wide.join(', ') || d.label || '';
  const rest = narrow.length > 0 ? wide : [];
  const secondary = [...rest, d.zip_code].filter(Boolean).join(' · ');

  return { primary, secondary };
}

/**
 * Whether a resolve attempt failed because no courier serves the place.
 *
 * Distinct from every other shipping failure in what the buyer should do: a
 * 503 means try again, this means try somewhere else. The server says so with
 * a code and not just a status, because "conflict" alone is not specific
 * enough to change the copy on.
 */
export function isUnserved(error) {
  return error?.status === 409 && error?.code === 'destination_unserved';
}

/**
 * The nearby places that do resolve, offered alongside the refusal.
 *
 * Defensive about the shape because it arrives in `details`, which is an open
 * map: an older server sends nothing there, and calling .map on undefined in
 * an error path would replace a helpful message with a blank screen.
 */
export function unservedAlternatives(error) {
  const alts = error?.details?.alternatives;
  return Array.isArray(alts) ? alts : [];
}

/** One line, for the summary row and the confirmed-route header. */
export function destinationSummary(d) {
  const { primary, secondary } = destinationLines(d);
  return [primary, secondary].filter(Boolean).join(' · ');
}

/**
 * Where a query matched, so the list can emphasise it.
 *
 * Case-insensitive and literal — the buyer typed letters, not a pattern.
 * Returns null when there is no match, which happens legitimately: the
 * provider matches on parts of the label this line does not show.
 */
export function matchRange(text, query) {
  const t = String(text ?? '');
  const q = String(query ?? '').trim();
  if (!t || !q) return null;
  const at = t.toLowerCase().indexOf(q.toLowerCase());
  return at < 0 ? null : { start: at, end: at + q.length };
}

/**
 * The billable weight in kilograms, as a numeral.
 *
 * Always a whole kilogram, because that is what the server quotes at and what
 * couriers bill: a 300g parcel and a 900g parcel cost the same.
 */
export function weightInKg(grams) {
  const g = Number(grams);
  if (!Number.isFinite(g) || g <= 0) return '';
  return String(Math.max(1, Math.ceil(g / 1000)));
}

/**
 * An ETA split into the number and the rest.
 *
 * The rate list leads on speed, so the numeral is set large in the display
 * face and the unit stays small beside it. The couriers do not agree with each
 * other — "2-3 day", "1-2 HARI", "1 hari" all arrive — and the server
 * normalises the shape but deliberately not the language, so anything
 * unparseable is passed through whole rather than mangled.
 */
export function splitEtd(etd) {
  const s = String(etd ?? '').trim();
  if (!s) return { value: '', unit: '' };

  const m = s.match(/^(\d+(?:\s*-\s*\d+)?)\s*(.*)$/);
  if (!m) return { value: '', unit: s };
  return { value: m[1].replace(/\s+/g, ''), unit: m[2].trim() };
}

/**
 * Which option a buyer should land on when the list first appears.
 *
 * The cheapest, not the first: the merchant's order is their own ranking and
 * is worth keeping in the list, but pre-selecting the expensive express
 * service would charge an inattentive buyer for a choice they did not make.
 * Ties keep merchant order, so it is stable.
 */
export function defaultOption(options) {
  const rows = options ?? [];
  if (rows.length === 0) return null;
  return rows.reduce((best, o) => (o.cost < best.cost ? o : best), rows[0]);
}

/**
 * Whether a chosen quote is still one of the ones on offer.
 *
 * The list is re-fetched whenever the destination or the cart changes, and a
 * quote id from the previous list would be refused at the draft step. Checking
 * here means the buyer re-picks while they are still looking at the options,
 * rather than being bounced back from the next screen.
 */
export function isStillOffered(options, quoteId) {
  return Boolean(quoteId) && (options ?? []).some((o) => o.quote_id === quoteId);
}
