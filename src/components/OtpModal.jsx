import { useEffect, useRef, useState } from 'react';

import { CountdownClock, CountdownWords } from '../ui/Countdown.jsx';

/**
 * The verification step.
 *
 * The prototype generated the code in the browser and printed it on screen.
 * Now the code exists only on the server (as an HMAC) and in the buyer's inbox.
 *
 * One error message covers every failure, because the API returns one: wrong
 * code, expired code, too many attempts, and a code issued for a different
 * checkout are deliberately indistinguishable. So the UI never guesses at a
 * reason — after a couple of failures it simply offers a new code.
 */
export default function OtpModal({
  otp,
  verifying,
  resending,
  onVerify,
  onResend,
  onCancel,
}) {
  const [code, setCode] = useState('');
  const [expired, setExpired] = useState(false);
  const [cooling, setCooling] = useState(() => isCooling(otp.nextAllowedAt));
  const inputRef = useRef(null);
  const dialogRef = useRef(null);

  // A resend replaces the challenge, so the field must not keep the old code.
  useEffect(() => {
    setCode('');
    setExpired(false);
    setCooling(isCooling(otp.nextAllowedAt));
    inputRef.current?.focus();
  }, [otp.expiresAt, otp.nextAllowedAt]);

  // Escape closes, and focus is kept inside — neither of which the prototype
  // did, which made the modal a trap for keyboard users.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') return onCancel();
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const canVerify = code.length === 6 && !verifying && !expired;
  const submit = () => canVerify && onVerify(code);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(67,56,46,0.45)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        zIndex: 150,
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Verifikasi pesanan"
        style={{
          background: '#FFFDF7',
          borderRadius: 24,
          padding: '30px 26px 24px',
          width: 'min(400px,100%)',
          boxShadow: '0 24px 60px rgba(67,56,46,0.28)',
        }}
      >
        <h2
          style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: 28,
            fontWeight: 600,
            margin: 0,
            textAlign: 'center',
          }}
        >
          Masukkan kode
        </h2>
        <p
          style={{
            fontSize: 14,
            color: '#8A7D70',
            textAlign: 'center',
            margin: '8px 0 20px',
            lineHeight: 1.6,
          }}
        >
          Kami mengirim kode 6 digit ke{' '}
          <strong style={{ color: '#43382E' }}>{otp.masked}</strong>
        </p>

        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="______"
          aria-label="Kode verifikasi"
          aria-invalid={Boolean(otp.error)}
          disabled={verifying}
          autoFocus
          style={{
            width: '100%',
            border: `1px solid ${otp.error ? '#E3A0B8' : '#F0E4CF'}`,
            borderRadius: 14,
            padding: '14px 16px',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '0.5em',
            textAlign: 'center',
            background: '#fff',
          }}
        />

        <div style={{ minHeight: 22, marginTop: 10, textAlign: 'center' }}>
          {otp.error ? (
            <span role="alert" style={{ color: '#C05C7E', fontSize: 13 }}>
              {otp.error}
            </span>
          ) : expired ? (
            <span style={{ color: '#C05C7E', fontSize: 13 }}>
              Kode kedaluwarsa. Kirim ulang untuk mendapatkan yang baru.
            </span>
          ) : (
            <span style={{ color: '#B7AA9A', fontSize: 13 }}>
              Berlaku <CountdownClock until={otp.expiresAt} onExpire={() => setExpired(true)} /> lagi
            </span>
          )}
        </div>

        <button
          type="button"
          className="hv-primary"
          onClick={submit}
          disabled={!canVerify}
          style={{
            width: '100%',
            marginTop: 14,
            background: canVerify ? '#D26E8E' : '#E4DACB',
            color: canVerify ? '#fff' : '#8A7D70',
            borderRadius: 999,
            padding: '14px 26px',
            fontWeight: 700,
            fontSize: 15,
            cursor: canVerify ? 'pointer' : 'not-allowed',
          }}
        >
          {verifying ? 'Memverifikasi…' : 'Verifikasi'}
        </button>

        {/* After two failures, stop letting the buyer guess and put the new
            code within reach — the server will not tell us which failure it was. */}
        {otp.attempts >= 2 && !cooling ? (
          <p style={{ fontSize: 12.5, color: '#8A7D70', textAlign: 'center', margin: '12px 0 0' }}>
            Masih gagal? Minta kode baru di bawah.
          </p>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16 }}>
          <button
            type="button"
            onClick={onResend}
            disabled={cooling || resending}
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: cooling || resending ? '#B7AA9A' : '#B4557A',
              cursor: cooling || resending ? 'not-allowed' : 'pointer',
            }}
          >
            {resending ? (
              'Mengirim…'
            ) : cooling ? (
              <>
                Kirim ulang dalam{' '}
                <CountdownWords until={otp.nextAllowedAt} onExpire={() => setCooling(false)} />
              </>
            ) : (
              'Kirim ulang kode'
            )}
          </button>
          <button type="button" onClick={onCancel} style={{ fontSize: 13.5, color: '#8A7D70' }}>
            Batal
          </button>
        </div>

        {/* A resend invalidates the previous code — worth saying, since the
            buyer may still be looking at the older email. */}
        <p style={{ fontSize: 11.5, color: '#C3B8AC', textAlign: 'center', margin: '14px 0 0' }}>
          Kode baru akan menggantikan kode sebelumnya.
        </p>
      </div>
    </div>
  );
}

function isCooling(nextAllowedAt) {
  return Boolean(nextAllowedAt) && Date.parse(nextAllowedAt) > Date.now();
}
