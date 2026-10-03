import { Link } from 'react-router-dom';

import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';
import { BrandMark } from './BrandMark.jsx';
import { sectionText, whatsappText } from '../lib/copy.js';

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
          <BrandMark
            height={38}
            maxWidth={240}
            wordmark={{ primary: '#FFFDF7', accent: '#F3B8C8', size: 30 }}
          />
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
          <div style={colTitle}>{sectionText(brand.sections, 'footer_shop_heading')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14.5 }}>
            {shopLinks.map((n) => (
              <Link key={n.path} className="hv-blush" to={n.path} style={{ color: '#E8DECF' }}>
                {n.label}
              </Link>
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 220px' }}>
          <div style={colTitle}>{sectionText(brand.sections, 'footer_contact_heading')}</div>
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
                  {whatsappText(brand)}
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
          <div style={colTitle}>{sectionText(brand.sections, 'footer_payment_heading')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chips(paymentMethods).map((p) => (
              <Chip key={p.code} item={p} />
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

/**
 * One chip per badge: "VA BCA" and "Transfer BCA" are the same mark to a
 * buyer checking whether the shop takes their bank. A name the platform has
 * no badge for stays text.
 */
export function chips(items) {
  const seen = new Set();
  return items.filter((x) => !x.logo_url || (!seen.has(x.logo_url) && seen.add(x.logo_url)));
}

const chip = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  background: '#5A4C3F',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
};

function Chip({ item }) {
  if (!item.logo_url) return <span style={chip}>{item.name}</span>;
  // A badge sits on the page's own cream: a full-colour mark is unreadable on the brown.
  return (
    <span className="la-logo-chip" style={{ ...chip, background: '#FFFDF7' }} title={item.name}>
      <img src={item.logo_url} alt={item.name} loading="lazy" />
    </span>
  );
}
