import { Link } from 'react-router-dom';

import { useConfig } from '../config/ConfigProvider.jsx';

const colTitle = {
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#B49E6A',
  marginBottom: 12,
};

export default function Footer() {
  const { brand, paymentMethods } = useConfig();

  // The nav the header shows, minus Beranda — the wordmark already goes there.
  const shopLinks = brand.nav.filter((n) => n.path !== '/');

  return (
    <footer style={{ background: '#43382E', color: '#E8DECF', marginTop: 'auto' }}>
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '44px 20px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 36,
        }}
      >
        <div style={{ flex: '2 1 260px', minWidth: 240 }}>
          <div
            style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontStyle: 'italic',
              fontWeight: 600,
              fontSize: 30,
              color: '#FFFDF7',
            }}
          >
            {brand.wordmark_primary}{' '}
            <span style={{ color: '#F3B8C8' }}>{brand.wordmark_accent}</span>
          </div>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: '#C9BBA8',
              maxWidth: '36ch',
              margin: '10px 0 0',
            }}
          >
            {brand.tagline}
          </p>
        </div>

        <div style={{ flex: '1 1 170px' }}>
          <div style={colTitle}>Belanja</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14.5 }}>
            {shopLinks.map((n) => (
              <Link key={n.path} className="hv-blush" to={n.path} style={{ color: '#E8DECF' }}>
                {n.label}
              </Link>
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 220px' }}>
          <div style={colTitle}>Hubungi kami</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.8, color: '#C9BBA8' }}>
            {brand.address_line1}
            <br />
            {brand.address_line2}
            {brand.whatsapp_url ? (
              <>
                <br />
                <a
                  href={brand.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#F3B8C8' }}
                >
                  {brand.whatsapp_text}
                </a>
              </>
            ) : null}
            {brand.email ? (
              <>
                <br />
                {brand.email}
              </>
            ) : null}
          </div>
        </div>

        <div style={{ flex: '1 1 180px' }}>
          <div style={colTitle}>Pembayaran</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {paymentMethods.map((p) => (
              <span
                key={p.code}
                style={{
                  background: '#5A4C3F',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid #5A4C3F',
          textAlign: 'center',
          padding: '16px 20px',
          fontSize: 12.5,
          color: '#8A7D70',
        }}
      >
        {brand.copyright}
      </div>
    </footer>
  );
}
