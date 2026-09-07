import { Link } from 'react-router-dom';

import { Img, SIZES } from '../ui/Img.jsx';
import { overlayLabel } from '../lib/availability.js';
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

/**
 * Both chips share one row rather than each owning a corner.
 *
 * They used to be two independently pinned absolutes, `left: 12` and
 * `right: 12`, which is exactly as wide as the card is — until it isn't. In a
 * two-up grid on a phone a card is around 165px, the two pills together want
 * closer to 190px, and absolutes cannot see each other: the pre-order chip
 * simply painted over the discount. One flex row lets them wrap instead, so
 * the second chip drops to a second line and both stay readable at any width.
 *
 * `pointerEvents: none` because the row spans the photo and the whole card is
 * a link; the chips are labels, not targets.
 */
const badgeRowStyle = {
  position: 'absolute',
  top: 12,
  left: 12,
  right: 12,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  pointerEvents: 'none',
};

const badgeStyle = {
  background: '#D26E8E',
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  borderRadius: 999,
  padding: '5px 11px',
  // A pill wraps as a whole or not at all — breaking "PRE-ORDER" across two
  // lines inside its own capsule looks like a rendering fault, not a label.
  whiteSpace: 'nowrap',
  flexShrink: 0,
  // The guard for a promo name long enough to outgrow the card on its own.
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/**
 * The pre-order chip: same geometry as the promotion badge, opposite corner,
 * different tone.
 *
 * Two slots rather than one, because a discounted pre-order is an ordinary
 * thing and multiplexing would drop whichever label lost. Butter and gold
 * rather than the badge's pink: in this palette pink persuades (badges,
 * buttons, sale prices) and gold informs (the category eyebrow above every
 * product name). A delivery window is a fact, not an offer, so it takes the
 * informational tone and stays quieter than the discount beside it.
 *
 * Shown in every variant, including `related`, whose showBadge:false withholds
 * marketing — a buyer arriving from "Kamu mungkin suka" is owed this before
 * they add to cart, not after.
 */
const preorderBadgeStyle = {
  ...badgeStyle,
  // Pushed to the far edge of whichever line it lands on, so it keeps the
  // opposite-corner reading when both fit and still sits apart from the
  // discount when they stack.
  marginLeft: 'auto',
  background: '#F5E6AE',
  color: '#8A6D1F',
};

/**
 * The unavailable wash, over the photo.
 *
 * A state of the whole card rather than a label on it, which is why it takes
 * the middle of the image instead of a third badge corner: a buyer scanning a
 * grid needs to know this one is out before they read its name, and the two
 * corners are already spoken for by an offer and a delivery promise.
 *
 * The cream is translucent so the photograph still reads underneath — the
 * product is coming back, or coming soon, and hiding it entirely would be a
 * stronger claim than the shop is making.
 */
const overlayStyle = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(255,253,247,0.72)',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '0 12px',
  fontWeight: 700,
  fontSize: 13,
  color: '#8A7D70',
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
  // One overlay slot for every reason a card cannot be bought, because they
  // are one thing to a buyer looking at a grid: an unavailable product. Which
  // reason is what the label says.
  const overlay = overlayLabel(p);

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
        {(withBadge || p.preorder) && (
          <div style={badgeRowStyle}>
            {withBadge && <span style={badgeStyle}>{p.badge}</span>}
            {p.preorder && <span style={preorderBadgeStyle}>PRE-ORDER</span>}
          </div>
        )}
        {showSoldOut && overlay && (
          <span style={overlayStyle}>
            <span style={{ letterSpacing: '0.14em' }}>{overlay.title}</span>
            {overlay.detail ? (
              // The date is the useful half of "SEGERA", so it is set as text
              // rather than as more tracked-out capitals: a buyer reads it,
              // they do not scan it.
              <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: 0, color: '#6E4634' }}>
                {overlay.detail}
              </span>
            ) : null}
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
