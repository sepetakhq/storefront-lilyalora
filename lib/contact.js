// The buyer is identified by one contact field whose meaning is tenant
// configuration: config.contact.channel is "email" or "whatsapp".
//
// These rules mirror notify.Normalize in the backend on purpose. The server
// validates regardless — this exists so the buyer is told before spending one
// of five OTP sends per hour, not after.

export const CHANNEL_EMAIL = 'email';
export const CHANNEL_WHATSAPP = 'whatsapp';

/** Reduces an Indonesian mobile number to bare 62… digits. */
export function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) return '62' + d.slice(1);
  if (d.startsWith('62')) return d;
  return '62' + d;
}

function looksLikeEmail(s) {
  const at = s.indexOf('@');
  if (at <= 0 || at === s.length - 1) return false;
  if ((s.match(/@/g) || []).length !== 1) return false;
  const domain = s.slice(at + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return false;
  if (s.includes('..')) return false;
  return !/\s/.test(s);
}

/** The value actually sent to the API, normalised the way the server will. */
export function normalizeContact(channel, raw) {
  const v = String(raw || '').trim();
  return channel === CHANNEL_WHATSAPP ? normalizePhone(v) : v.toLowerCase();
}

/**
 * @returns {string|null} the server's own wording for the failure, or null
 *   when the value is acceptable.
 *
 * Empty and malformed are different failures and get different wording. They
 * used to share one message, so leaving the field blank was reported as
 * "Alamat email tidak valid." — telling the buyer to correct something they
 * had not written yet.
 *
 * Blankness is judged on what the buyer typed, not on the normalised value:
 * normalizePhone returns an empty string for input it cannot parse, so
 * checking the result would call "abcdef" empty too.
 */
export function validateContact(channel, raw) {
  if (String(raw ?? '').trim() === '') {
    return `${contactField(channel).label} belum diisi.`;
  }
  const v = normalizeContact(channel, raw);
  if (!v) {
    return channel === CHANNEL_WHATSAPP
      ? 'Nomor WhatsApp tidak valid.'
      : 'Alamat email tidak valid.';
  }
  if (channel === CHANNEL_WHATSAPP) {
    return v.length >= 10 ? null : 'Nomor WhatsApp tidak valid.';
  }
  return looksLikeEmail(v) ? null : 'Alamat email tidak valid.';
}

/** Everything the contact input needs to label and type itself. */
export function contactField(channel) {
  if (channel === CHANNEL_WHATSAPP) {
    return {
      label: 'Nomor WhatsApp',
      placeholder: '08xx xxxx xxxx',
      type: 'tel',
      inputMode: 'tel',
      autoComplete: 'tel',
      // Used in "Kami mengirim kode ke <this>".
      noun: 'WhatsApp',
    };
  }
  return {
    label: 'Email',
    placeholder: 'nama@email.com',
    type: 'email',
    inputMode: 'email',
    autoComplete: 'email',
    noun: 'email',
  };
}
