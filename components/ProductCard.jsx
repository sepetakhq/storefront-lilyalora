import { Link } from 'react-router-dom';

import { Img, SIZES } from '../ui/Img.jsx';
import { fmt } from '../shared/format.js';

const VARIANTS = {
  // Home "paling disukai" grid and the catalog grid.
  grid: {
    border: '#F0E4CF',
    hoverClass: 'hv-card',
    priceColor: '#43382E',
    priceSize: 16,
    nameSize: 15.5,
    showCategory: true,
    showBadge: true,
    showOldPrice: true,
    body: '14px 16px 16px',
  },
  // Campaign strip — pink chrome, badge always present.
  campaign: {
    border: '#F7DCE5',
    hoverClass: 'hv-card-pink',
    priceColor: '#D26E8E',
    priceSize: 16,
    nameSize: 15.5,
    showCategory: true,
    showBadge: 'always',
    showOldPrice: true,
    body: '14px 16px 16px',
  },
  // Horizontal scroller — fixed width, no category line.
  carousel: {
    border: '#F0E4CF',
    hoverClass: 'hv-shadow',
    priceColor: '#D26E8E',
    priceSize: 14.5,
    nameSize: 14.5,
    showCategory: false,
    showBadge: true,
    showOldPrice: true,
    body: '12px 14px 14px',
  },
  // "Kamu mungkin suka" on the product page — name and price only.
  related: {
    border: '#F0E4CF',
    hoverClass: 'hv-shadow',
    priceColor: '#D26E8E',
    priceSize: 14.5,
    nameSize: 14.5,
    showCategory: false,
    showBadge: false,
    showOldPrice: false,
    body: '12px 14px 14px',
  },
};

const badgeStyle = {
  position: 'absolute',
  top: 12,
  left: 12,
  background: '#D26E8E',
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  borderRadius: 999,
  padding: '5px 11px',
};

/**
 * `p` is the API's productCard DTO, consumed directly.
 *
 * The prototype mapped it through a client-side view model that recomputed
 * discounts in the browser. That is exactly the divergence the server-side
 * promo engine exists to prevent: the price shown here now comes from the same
 * engine that prices the order.
 *
 * @param {boolean} priority  eager-load — for the first row above the fold only
 */
export default function ProductCard({ p, variant = 'grid', showSoldOut = false, priority = false }) {
  const v = VARIANTS[variant];
  const withBadge = (v.showBadge === 'always' || v.showBadge) && Boolean(p.badge);

  return (
    <Link
      to={`/produk/${p.slug}`}
      className={v.hoverClass}
      style={{
        textAlign: 'left',
        color: 'inherit',
        background: '#fff',
        border: `1px solid ${v.border}`,
        borderRadius: 18,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        ...(variant === 'carousel' ? { flex: '0 0 220px' } : null),
      }}
    >
      <div style={{ position: 'relative' }}>
        <Img
          src={p.image}
          srcSet={p.image_srcset}
          sizes={variant === 'carousel' ? '220px' : SIZES.card}
          alt={p.name}
          ratio="4/5"
          width={p.image_width}
          height={p.image_height}
          priority={priority}
        />
        {withBadge && <span style={badgeStyle}>{p.badge}</span>}
        {showSoldOut && p.sold_out && (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255,253,247,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: '#8A7D70',
            }}
          >
            HABIS
          </span>
        )}
      </div>

      <div style={{ padding: v.body }}>
        {v.showCategory && (
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#B49E6A',
            }}
          >
            {p.category_label}
          </div>
        )}
        <div
          style={{
            fontWeight: 700,
            fontSize: v.nameSize,
            margin: v.showCategory ? '3px 0 6px' : 0,
          }}
        >
          {p.name}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'baseline',
            marginTop: v.showCategory ? 0 : 4,
          }}
        >
          <span style={{ fontWeight: 700, color: v.priceColor, fontSize: v.priceSize }}>
            {fmt(p.price)}
          </span>
          {v.showOldPrice && p.on_sale && (
            <s style={{ color: '#B7AA9A', fontSize: variant === 'carousel' ? 12.5 : 13 }}>
              {fmt(p.compare_at_price)}
            </s>
          )}
        </div>
      </div>
    </Link>
  );
}
