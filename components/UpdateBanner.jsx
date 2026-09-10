import { useLocation } from 'react-router-dom';

import { useBuildUpdate } from '../shared/useBuildUpdate.js';

// The two places a buyer is mid-transaction. A reload is safe on both — the
// cart is written through to localStorage and the checkout draft to
// sessionStorage — but offering one to someone staring at a QR code they are
// halfway through paying is the worst possible moment to interrupt. They will
// reach a new build on their next visit anyway.
const QUIET_PREFIXES = ['/checkout', '/pesanan/', '/track/'];

/**
 * Offers a reload when a newer build has shipped under an open tab.
 *
 * Never reloads on its own. The buyer may be typing an address, and the whole
 * point of the banner is that this tab has been sitting here long enough for
 * the world to move on underneath it.
 */
export default function UpdateBanner() {
  const { updateReady, dismiss } = useBuildUpdate();
  const { pathname } = useLocation();

  if (!updateReady) return null;
  if (QUIET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        width: '100%',
        padding: '10px 16px',
        background: '#FFF4E8',
        borderBottom: '1px solid #F3B8C8',
        color: '#43382E',
        fontSize: 13.5,
        lineHeight: 1.5,
      }}
    >
      <span>Versi baru tersedia.</span>
      <span style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            border: 'none',
            borderRadius: 999,
            padding: '5px 14px',
            background: '#B4557A',
            color: '#FFFDF7',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Muat ulang
        </button>
        <button
          type="button"
          onClick={dismiss}
          style={{
            border: '1px solid #E3D3C6',
            borderRadius: 999,
            padding: '5px 14px',
            background: 'transparent',
            color: '#6E4634',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Nanti
        </button>
      </span>
    </div>
  );
}
