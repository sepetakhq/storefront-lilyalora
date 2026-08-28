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

const DATETIME_FMT = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function fmtDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : DATETIME_FMT.format(d);
}

/** mm:ss for the OTP and payment countdowns. */
export function fmtClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
