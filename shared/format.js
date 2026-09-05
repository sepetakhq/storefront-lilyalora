// The API speaks whole rupiah as int64 and never pre-formats. Formatting is
// the storefront's job, and this is the only place that does it.

export function fmt(n) {
  return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
}

const DATE_FMT = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Accepts an RFC3339 string from the API or an epoch number. */
export function fmtDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : DATE_FMT.format(d);
}

const DATETIME_DATE_FMT = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
});

/**
 * The clock, as everyone writes it down.
 *
 * Not `Intl`: `id-ID` separates hours from minutes with a dot, so a formatter
 * asked for a time renders half past four as `16.22` — which reads as a
 * decimal, and which nobody in a warehouse writes on a label. The date half
 * still goes through `Intl`, because month names are exactly what a locale is
 * for.
 */
export function fmtTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${DATETIME_DATE_FMT.format(d)}, ${fmtTime(d)}`;
}

/** mm:ss for the OTP and payment countdowns, h:mm:ss past an hour. */
export function fmtClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60);
  const s = total % 60;
  // Hours only once there are any. Every existing caller — the OTP window, a
  // gateway payment deadline — is minutes, so their output is unchanged to the
  // character. A manual payment window is a day, and without this it read
  // "1439:59", which is not a duration anybody can parse.
  if (h > 0) {
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}


/**
 * A merchant's multi-line copy, split into paragraphs.
 *
 * The API stores the about story as one string, because that is what a
 * merchant types into one textarea. Where the paragraphs fall is markup, and
 * markup is the storefront's job — the same division that keeps Rupiah
 * formatting on this side of the wire.
 *
 * A blank line is the break. Runs of them collapse, because a merchant who
 * pressed enter four times meant one paragraph break, and `\r\n` is handled
 * because a Windows textarea sends it.
 */
export function paragraphs(text) {
  if (!text) return [];
  return String(text)
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Brand copy ships with literal placeholders the storefront substitutes,
 * because the API deliberately does not own Rupiah formatting.
 * Currently only {free_shipping_min}.
 */
export function interpolate(text, values) {
  if (!text) return '';
  return text.replace(/\{(\w+)\}/g, (whole, key) =>
    key in values ? values[key] : whole,
  );
}

/**
 * Brand copy, or '' when it advertises free shipping the shop no longer
 * offers.
 *
 * The placeholder is the marker. A merchant string that names
 * {free_shipping_min} is a promise about the checkout -- "gratis ongkir di
 * atas ..." -- so when the offer is switched off the string is withheld rather
 * than interpolated: substituting the threshold anyway would advertise a
 * discount the next screen refuses to give, and there is no number to put in
 * its place, since zero reads as "free for everyone".
 *
 * Copy that never mentions the threshold is unaffected either way -- it is not
 * about shipping, and hiding it would empty half the storefront.
 */
export function shippingCopy(text, values, freeShipping) {
  const s = text ?? '';
  if (freeShipping || !s.includes('{free_shipping_min}')) return interpolate(s, values);
  // Sentence by sentence, not the whole string: the product page's shipping
  // paragraph names the couriers and the cut-off time in the same breath as
  // the threshold, and dropping all of it left a "Pengiriman" panel that
  // opened onto nothing.
  const kept = (s.match(/[^.!?]+[.!?]*\s*/g) ?? [])
    .filter((sentence) => !sentence.includes('{free_shipping_min}'))
    .join('')
    .trim();
  return interpolate(kept, values);
}
