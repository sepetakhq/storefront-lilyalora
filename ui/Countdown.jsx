import { useCountdown } from '../hooks/useCountdown.js';
import { fmtClock } from '../shared/format.js';

/**
 * The isolation boundary that lets the global one-second tick die.
 *
 * A component that calls useCountdown re-renders every tick, so these render
 * nothing but the countdown itself. A campaign strip repaints three small
 * cells per second instead of eight product cards.
 */

export function CountdownCells({ until, onExpire }) {
  const { ms, active } = useCountdown(until, { onExpire });
  if (!active) return null;

  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Cell value={pad(h)} label="JAM" />
      <Cell value={pad(m)} label="MENIT" />
      <Cell value={pad(s)} label="DETIK" accent />
    </div>
  );
}

/** mm:ss, for the OTP and payment deadlines. */
export function CountdownClock({ until, onExpire, style }) {
  const { ms, active } = useCountdown(until, { onExpire });
  if (!active) return null;
  return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{fmtClock(ms)}</span>;
}

/** "60 detik" / "5 menit", for a resend button label. */
export function CountdownWords({ until, onExpire }) {
  const { ms, active } = useCountdown(until, { onExpire });
  if (!active) return null;
  const secs = Math.ceil(ms / 1000);
  return <>{secs < 60 ? `${secs} detik` : `${Math.ceil(secs / 60)} menit`}</>;
}

function Cell({ value, label, accent }) {
  return (
    <div
      style={{
        background: accent ? '#D26E8E' : '#43382E',
        color: accent ? '#fff' : '#FFFDF7',
        borderRadius: 10,
        padding: '8px 12px',
        fontWeight: 700,
        fontSize: 18,
        minWidth: 48,
        textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: accent ? '#F7DCE5' : '#C9BBA8',
          letterSpacing: '0.1em',
        }}
      >
        {label}
      </div>
    </div>
  );
}

const pad = (n) => String(n).padStart(2, '0');
