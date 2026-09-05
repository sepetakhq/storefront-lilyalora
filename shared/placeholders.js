/**
 * The placeholders a merchant may write into brand copy.
 *
 * There is one. That is worth saying plainly, because the `{...}` syntax looks
 * like a template language and is not one: anything not in this list passes
 * through `interpolate` untouched and reaches buyers as those literal
 * characters, in uppercase across the top of every page in the banner's case.
 * Nothing warns at render time, so the warning has to happen where the merchant
 * types.
 *
 * This list is the source of truth for the backoffice — the hint under each
 * field and the validation that refuses a typo both read it. The storefront's
 * substitution map in config/ConfigProvider.jsx and the Go port in
 * backend/internal/seo/copy.go are the two implementations that have to agree
 * with it; src/shared/shippingCopy.fixtures.json is the contract test that
 * keeps all three honest.
 *
 * Adding one means: a row here, an entry in that substitution map, the same in
 * the Go port, and a fixture case.
 */
export const PLACEHOLDERS = [
  {
    name: 'free_shipping_min',
    // Indonesian, because it is rendered in the backoffice.
    label: 'Batas gratis ongkir toko, misalnya "Rp 150.000".',
    // Naming this one changes the sentence's lifecycle, not just its wording,
    // and that is the part a merchant cannot guess.
    caveat:
      'Kalimat yang menyebutnya ikut disembunyikan kalau gratis ongkir dimatikan.',
  },
];

const KNOWN = new Set(PLACEHOLDERS.map((p) => p.name));

/** Every `{token}` in the text, in the order written, duplicates collapsed. */
export function placeholdersIn(text) {
  const found = String(text ?? '').match(/\{(\w+)\}/g) ?? [];
  return [...new Set(found.map((t) => t.slice(1, -1)))];
}

/**
 * The tokens the merchant wrote that nothing will ever substitute.
 *
 * The check that matters. A hint teaches whoever reads it; this catches
 * whoever does not, and a typo here is invisible until a buyer sees it —
 * `interpolate` deliberately leaves an unknown token alone rather than
 * blanking it, so the failure is loud on the storefront and silent everywhere
 * a merchant would look.
 */
export function unknownPlaceholders(text) {
  return placeholdersIn(text).filter((name) => !KNOWN.has(name));
}

/** The refusal shown under a field, or null when every token is real. */
export function placeholderProblem(text) {
  const unknown = unknownPlaceholders(text);
  if (unknown.length === 0) return null;

  const wrote = unknown.map((n) => `{${n}}`).join(', ');
  const available = PLACEHOLDERS.map((p) => `{${p.name}}`).join(', ');
  // Names both halves: what they typed and what exists. A message that only
  // said "invalid placeholder" would leave them guessing at the spelling,
  // which is how the typo happened.
  return `${wrote} tidak dikenali dan akan tampil apa adanya di toko. Yang tersedia: ${available}.`;
}
