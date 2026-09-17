import { Link, NavLink } from 'react-router-dom';

import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';
import { useCart } from '@sepetakhq/storefront-kit/cart/CartProvider';
import { BrandMark } from './BrandMark.jsx';

const bar = { width: 16, height: 2, background: '#43382E', borderRadius: 2 };

export default function Header({ isMobile, menuOpen, onToggleMenu, onNavigate }) {
  const { brand } = useConfig();
  const { count } = useCart();

  const navStyle = ({ isActive }) => ({
    color: isActive ? '#D26E8E' : '#43382E',
    padding: '4px 0',
    fontWeight: 600,
    fontSize: 14.5,
  });

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255,253,247,0.92)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #F0E4CF',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <Link
          to="/"
          onClick={onNavigate}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}
        >
          <BrandMark
            height={34}
            maxWidth={200}
            wordmark={{ primary: '#43382E', accent: '#D26E8E', size: 28 }}
          />
          <span
            style={{
              fontSize: 9,
              letterSpacing: '0.34em',
              textTransform: 'uppercase',
              color: '#B49E6A',
              marginTop: 2,
            }}
          >
            {brand.tagline_short}
          </span>
        </Link>

        {!isMobile && (
          <nav style={{ display: 'flex', gap: 26, marginLeft: 24 }}>
            {brand.nav.map((n) => (
              <NavLink key={n.path} to={n.path} end={n.path === '/'} className="hv-pink" style={navStyle}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link
            className="hv-cart"
            to="/keranjang"
            onClick={onNavigate}
            style={{
              position: 'relative',
              background: '#F3B8C8',
              borderRadius: 999,
              padding: '8px 18px',
              fontWeight: 700,
              fontSize: 14,
              color: '#7A3B54',
            }}
          >
            Keranjang
            {count > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  background: '#D26E8E',
                  color: '#fff',
                  borderRadius: 999,
                  minWidth: 20,
                  height: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '0 5px',
                }}
              >
                {count}
              </span>
            )}
          </Link>

          {isMobile && (
            <button
              onClick={onToggleMenu}
              aria-label="Menu"
              aria-expanded={menuOpen}
              style={{
                width: 38,
                height: 38,
                border: '1px solid #F0E4CF',
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span style={bar} />
              <span style={bar} />
              <span style={bar} />
            </button>
          )}
        </div>
      </div>

      {menuOpen && (
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderTop: '1px solid #F0E4CF',
            background: '#FFFDF7',
            padding: '8px 20px 14px',
            gap: 2,
          }}
        >
          {brand.nav.map((n, i) => (
            <NavLink
              key={n.path}
              to={n.path}
              end={n.path === '/'}
              onClick={onNavigate}
              style={({ isActive }) => ({
                textAlign: 'left',
                padding: '10px 4px',
                fontWeight: 600,
                fontSize: 15,
                color: isActive ? '#D26E8E' : '#43382E',
                borderBottom: i < brand.nav.length - 1 ? '1px solid #FAF3E4' : 'none',
              })}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
