import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import ProductCard from '../components/ProductCard.jsx';
import { Img, SIZES } from '../ui/Img.jsx';
import { EmptyState, ErrorState, Skeleton } from '../ui/states.jsx';
import { useProduct } from '@sepetakhq/storefront-kit/hooks/queries';
import { useCart } from '@sepetakhq/storefront-kit/cart/CartProvider';
import { isSoldOut, leadDays, maxQty, stockNote } from '@sepetakhq/storefront-kit/lib/preorder';
import { buyLabel, isImminent, isScheduled, msUntilOpen, windowNote } from '@sepetakhq/storefront-kit/lib/availability';
import {
  availableValues,
  galleryFor,
  initialSelection,
  isPriceRange,
  matchVariant,
  select,
  withVariant,
} from '@sepetakhq/storefront-kit/lib/variants';
import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';
import { useToast } from '@sepetakhq/storefront-kit/ui/ToastProvider';
import { fmt, fmtClock, paragraphs } from '@sepetakhq/storefront-kit/shared/format';
import { sectionText } from '../lib/copy.js';

const detailsRow = { borderBottom: '1px solid #F0E4CF', padding: '14px 4px' };
const summary = { fontWeight: 700, cursor: 'pointer', fontSize: 14.5 };
const detailsText = { color: '#8A7D70', fontSize: 14, lineHeight: 1.7, margin: '10px 0 0' };

export default function ProductRoute() {
  const { slug } = useParams();
  const { data: product, isPending, isError, error, refetch } = useProduct(slug);

  if (isPending) return <ProductSkeleton />;

  if (isError) {
    // A 404 means unpublished or removed — not a failure to explain away.
    if (error?.status === 404) {
      return (
        <main style={{ flex: 1, padding: '60px 20px' }}>
          <EmptyState
            title="Produk tidak ditemukan"
            body="Produk ini sudah tidak tersedia. Koleksi lainnya masih menunggu."
            action={
              <Link to="/katalog" className="hv-dark" style={darkButton}>
                Lihat katalog
              </Link>
            }
          />
        </main>
      );
    }
    return (
      <main style={{ flex: 1, padding: '60px 20px' }}>
        <ErrorState error={error} onRetry={refetch} title="Produk gagal dimuat" />
      </main>
    );
  }

  // `key` resets the gallery index when navigating between products.
  return <ProductView key={slug} product={product} onOpen={refetch} />;
}

/**
 * Ticks a countdown to the opening, and asks the server when it runs out.
 *
 * The tick is cosmetic. Reaching zero never enables the buy button on its own
 * — it refetches the product and lets the server's next answer decide, because
 * the only clock that may open a sale is the one checkout enforces. A browser
 * running a few minutes fast would otherwise offer a drop early and hand the
 * buyer a 409 at the end of a form they had already filled in.
 *
 * Nothing is scheduled for a drop that is days away: a page re-rendering every
 * second for a week costs a phone its battery to say what one line of text
 * already said. See isImminent.
 */
function useOpeningCountdown(product, onOpen) {
  const [now, setNow] = useState(() => Date.now());
  const ticking = isScheduled(product) && isImminent(product, now);

  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  const remaining = msUntilOpen(product, now);
  useEffect(() => {
    if (remaining === 0) onOpen?.();
  }, [remaining, onOpen]);

  if (!ticking || remaining === null) return null;
  return fmtClock(remaining);
}

function ProductView({ product, onOpen }) {
  const { brand, freeShipping, freeShippingMinLabel, copy } = useConfig();
  // The headings live on brand, where the provider shapes section_copy.
  // Reading them off the top level rendered a crash for every product page.
  const sections = brand.sections ?? {};
  const cart = useCart();
  const showToast = useToast();
  const navigate = useNavigate();

  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [broken, setBroken] = useState(() => new Set());

  // Which value is picked on each axis. Nothing is guessed beyond what
  // initialSelection allows, so a hurried buyer cannot be sold the wrong
  // colour by a default. `variant` is the one combination the picks name, or
  // null while a pick is missing or names nothing.
  const [selected, setSelected] = useState(() => initialSelection(product));
  const variant = matchVariant(product.variants, selected);
  // The product as judged for that variant -- its price, its stock -- so
  // every helper below reads the right number. Unchanged without variants.
  const sellable = withVariant(product, variant);
  const needsChoice = Boolean(product.has_variants) && !variant;
  const pick = (axis, value) => {
    setSelected((cur) => select(product, cur, axis, value));
    // A pick can change the photo and the stock ceiling, so the gallery and
    // the quantity restart from the top.
    setActive(0);
    setQty(1);
  };

  // The panel's three sections, resolved and then substituted, before anything
  // is gated on them.
  //
  // The server picked each line from the most specific tier that said anything
  // -- this product, then its category, then the shop -- so there is no
  // fallback left to apply here. What remains is substitution, which stays on
  // this side because the API deliberately does not own Rupiah formatting.
  //
  // The gates below read these and not the raw strings, because interpolation
  // is what decides whether a section has anything to say: a care copy whose
  // only sentence promises free shipping is withheld whole once the offer is
  // off, and "" is what is left. It does not then fall back to the category's
  // -- resolution happened on the stored text, and putting somebody else's
  // words where this merchant deliberately wrote their own would be worse than
  // saying nothing.
  const care = paragraphs(copy(product.care_copy));
  // Not run through copy(), and never was: routing a size line through the
  // free-shipping withholding rule would make it vanish with the offer.
  const spec = paragraphs(product.material_spec);
  const hasPanel =
    spec.length > 0 ||
    care.length > 0 ||
    Boolean(brand.productShippingCopy) ||
    freeShipping ||
    product.preorder;

  const all = product.images?.length
    ? product.images
    : [{ url: product.image, srcset: product.image_srcset, alt: product.name }];

  // An image whose bytes do not decode is dropped from the gallery rather than
  // left as a thumbnail that opens onto a blank frame. This is not theoretical:
  // a truncated upload is served as a 200 with content-type image/jpeg, and the
  // media worker marks the asset failed while the product still references it.
  const images = galleryFor(all, variant).filter((im) => !broken.has(im.url));
  const gallery = images.length ? images : all.slice(0, 1);
  const main = gallery[Math.min(active, gallery.length - 1)];

  // Stock is the variant's once one is picked; until then a variant product
  // says nothing about stock -- the picker is where that answer lives.
  const stock = needsChoice ? null : stockNote(sellable);
  const saleWindow = windowNote(product);
  // The server already accounts for pre-order in sold_out, and re-deriving it
  // from stock here is what used to refuse a made-to-order product.
  //
  // `blocked` is what the controls are gated on: sold out, closed, or not open
  // yet. `label` is the server's reason, rendered rather than guessed.
  const label = buyLabel(sellable);
  const blocked = isSoldOut(sellable) || Boolean(label);
  const max = maxQty(sellable);
  const countdown = useOpeningCountdown(product, onOpen);
  const disabled = blocked || needsChoice;

  const add = (then) => {
    cart.add(product, qty, variant?.id ?? null);
    showToast('Ditambahkan ke keranjang ✓');
    then?.();
  };

  return (
    <main
      aria-label="Detail produk"
      style={{ flex: 1, maxWidth: 1200, margin: '0 auto', padding: '28px 20px 60px', width: '100%' }}
    >
      <Link
        className="hv-pink"
        to="/katalog"
        style={{ display: 'inline-block', fontWeight: 700, color: '#B4557A', fontSize: 14, marginBottom: 18 }}
      >
        ← Kembali ke katalog
      </Link>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40 }}>
        <div style={{ flex: '1 1 400px', minWidth: 300 }}>
          <Img
            src={main.url}
            srcSet={main.srcset}
            sizes={SIZES.productMain}
            alt={main.alt || product.name}
            ratio="4/5"
            radius={22}
            width={main.width}
            height={main.height}
            priority
            onError={() => setBroken((b) => new Set(b).add(main.url))}
          />
          {gallery.length > 1 ? (
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              {gallery.map((im, i) => (
                <button
                  key={im.url || i}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Foto ${i + 1} dari ${gallery.length}`}
                  aria-current={i === active}
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: `2px solid ${i === active ? '#D26E8E' : '#F0E4CF'}`,
                    padding: 0,
                    lineHeight: 0,
                    width: 74,
                  }}
                >
                  <Img
                    src={im.url}
                    srcSet={im.srcset}
                    sizes={SIZES.thumb}
                    alt=""
                    ratio="74/92"
                    onError={() => setBroken((b) => new Set(b).add(im.url))}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ flex: '1 1 380px', minWidth: 300 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#B49E6A',
            }}
          >
            {product.spec_label || product.category_label}
          </div>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: 'clamp(32px,4.5vw,44px)',
              fontWeight: 600,
              margin: '8px 0 12px',
            }}
          >
            {product.name}
          </h1>

          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'baseline',
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 26, fontWeight: 700, color: '#D26E8E' }}>
              {/* "mulai" until a variant is picked, when there is a range to
                  speak of; the exact price the moment one is. */}
              {needsChoice && isPriceRange(product) ? (
                <>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#B7AA9A', marginRight: 6 }}>mulai</span>
                  {fmt(product.price)}
                </>
              ) : (
                fmt(sellable.price)
              )}
            </span>
            {sellable.on_sale ? (
              <>
                <s style={{ color: '#B7AA9A', fontSize: 17 }}>{fmt(sellable.compare_at_price)}</s>
                <span
                  style={{
                    background: '#FDF0F4',
                    color: '#D26E8E',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: '4px 10px',
                  }}
                >
                  {sellable.badge}
                </span>
              </>
            ) : null}
            {product.preorder ? (
              // Tinted like the sale chip beside it, in gold rather than pink:
              // same weight of statement, different kind of claim.
              <span
                style={{
                  background: '#FDF6E3',
                  color: '#8A6D1F',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: '4px 10px',
                }}
              >
                PRE-ORDER
              </span>
            ) : null}
          </div>

          <p style={{ color: '#8A7D70', fontSize: 15.5, lineHeight: 1.7, margin: '0 0 20px' }}>
            {product.description}
          </p>

          {product.has_variants ? (
            <VariantPicker product={product} selected={selected} onPick={pick} />
          ) : null}

          {saleWindow ? (
            <div style={{ fontSize: 13.5, fontWeight: 600, color: saleWindow.color, marginBottom: 6 }}>
              {saleWindow.text}
              {countdown ? <span style={{ color: '#B4557A' }}> · {countdown}</span> : null}
            </div>
          ) : null}
          {/* Null for unlimited stock: there is no count to quote and no
              promise to state, so the line is simply absent. */}
          {stock ? (
            <div style={{ fontSize: 13.5, fontWeight: 600, color: stock.color, marginBottom: 18 }}>
              {stock.text}
            </div>
          ) : null}

          <div
            style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                border: '1px solid #F0E4CF',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                className="hv-cream"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={disabled || qty <= 1}
                aria-label="Kurangi jumlah"
                style={stepper}
              >
                −
              </button>
              <span style={{ minWidth: 40, textAlign: 'center', fontWeight: 700, fontSize: 16 }}>
                {qty}
              </span>
              <button
                type="button"
                className="hv-cream"
                onClick={() => setQty((q) => Math.min(max, q + 1))}
                disabled={disabled || qty >= max}
                aria-label="Tambah jumlah"
                style={stepper}
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="hv-primary"
              onClick={() => add()}
              disabled={disabled}
              style={{
                flex: 1,
                minWidth: 200,
                background: disabled ? '#E4DACB' : '#D26E8E',
                color: disabled ? '#8A7D70' : '#fff',
                borderRadius: 999,
                padding: '14px 26px',
                fontWeight: 700,
                fontSize: 15,
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: disabled ? 'none' : '0 8px 20px rgba(210,110,142,0.3)',
              }}
            >
              {blocked ? (label ?? 'Stok habis') : needsChoice ? 'Pilih varian dulu' : 'Tambah ke Keranjang'}
            </button>
          </div>

          <button
            type="button"
            className="hv-butter"
            onClick={() => add(() => navigate('/keranjang'))}
            disabled={disabled}
            style={{
              width: '100%',
              background: '#F5E6AE',
              color: '#6E4634',
              borderRadius: 999,
              padding: '14px 26px',
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 26,
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            Beli Sekarang
          </button>

          {/* The rule is gated too, not only the sections under it: a product
              with nothing to say in any of them used to draw a bare 1px line
              under the buy button and stop there. */}
          {hasPanel && (
            <div style={{ borderTop: '1px solid #F0E4CF' }}>
              {spec.length > 0 ? (
                <details style={detailsRow}>
                  <summary style={summary}>{sectionText(sections, 'product_details_heading')}</summary>
                  {spec.map((t, i) => (
                    <p key={i} style={detailsText}>
                      {t}
                    </p>
                  ))}
                </details>
              ) : null}
              {/* Gated, where it used to render unconditionally: a shop that had
                  never written care copy got a panel opening onto nothing. */}
              {care.length > 0 ? (
                <details style={detailsRow}>
                  <summary style={summary}>{sectionText(sections, 'product_care_heading')}</summary>
                  {care.map((t, i) => (
                    <p key={i} style={detailsText}>
                      {t}
                    </p>
                  ))}
                </details>
              ) : null}
              {/* Both lines can be withheld at once -- a merchant whose shipping
                  copy says nothing but "gratis ongkir di atas ..." -- and a panel
                  that opens onto nothing is worse than no panel. */}
              {(brand.productShippingCopy || freeShipping || product.preorder) && (
                <details style={{ padding: '14px 4px' }}>
                  <summary style={summary}>{sectionText(sections, 'product_shipping_heading')}</summary>
                  {/* First, because it changes what every line below it means:
                      the courier only starts counting once the item exists. */}
                  {product.preorder && (
                    <p style={{ ...detailsText, color: '#8A6D1F', fontWeight: 600 }}>
                      {leadDays(product)
                        ? `Produk ini dibuat setelah pesanan dibayar. Perkiraan siap kirim ±${leadDays(product)} hari sejak pembayaran diterima, lalu dikirim seperti biasa.`
                        : 'Produk ini dibuat setelah pesanan dibayar, lalu dikirim seperti biasa.'}
                    </p>
                  )}
                  {brand.productShippingCopy && (
                    <p style={detailsText}>{brand.productShippingCopy}</p>
                  )}
                  {/* Hardcoded rather than brand copy, so it needs its own gate:
                      promising a threshold the checkout ignores is worse than
                      saying nothing about shipping at all. */}
                  {freeShipping && (
                    <p style={{ ...detailsText, marginTop: 6 }}>
                      Gratis ongkir untuk belanja di atas {freeShippingMinLabel}.
                    </p>
                  )}
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {product.related?.length > 0 ? (
        <>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: 30,
              fontWeight: 600,
              margin: '48px 0 18px',
            }}
          >
            {sectionText(sections, 'related_heading')}
          </h2>
          <div className="product-grid">
            {product.related.map((p) => (
              <ProductCard key={p.id} p={p} variant="related" />
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}

const stepper = { width: 42, height: 46, fontSize: 18, fontWeight: 700 };

const darkButton = {
  display: 'inline-block',
  background: '#43382E',
  color: '#FFFDF7',
  borderRadius: 999,
  padding: '13px 28px',
  fontWeight: 700,
  fontSize: 14.5,
};

function ProductSkeleton() {
  return (
    <main
      aria-busy="true"
      style={{ flex: 1, maxWidth: 1200, margin: '0 auto', padding: '28px 20px 60px', width: '100%' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, marginTop: 34 }}>
        <div style={{ flex: '1 1 400px', minWidth: 300 }}>
          <Skeleton ratio="4/5" radius={22} />
        </div>
        <div style={{ flex: '1 1 380px', minWidth: 300 }}>
          <Skeleton height={14} width={140} />
          <Skeleton height={40} style={{ marginTop: 14 }} />
          <Skeleton height={26} width={160} style={{ marginTop: 16 }} />
          <Skeleton height={14} style={{ marginTop: 22 }} />
          <Skeleton height={14} width="80%" style={{ marginTop: 8 }} />
          <Skeleton height={46} radius={999} style={{ marginTop: 26 }} />
        </div>
      </div>
    </main>
  );
}

/**
 * One row of pills per axis. A pill the shop does not sell in combination
 * with what is already picked is greyed out; one that is sold out is struck
 * through as well, so the two reasons read differently. Both are disabled:
 * the server would refuse either, and a buyer should not learn that at
 * checkout.
 */
function VariantPicker({ product, selected, onPick }) {
  return (
    <div style={{ display: 'grid', gap: 16, marginBottom: 22 }}>
      {product.options.map((axis) => {
        const picked = selected[axis.name];
        return (
          <div key={axis.name} role="group" aria-label={`Pilih ${axis.name}`}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#43382E', marginBottom: 8 }}>
              Pilih {axis.name}
              {picked ? <span style={{ fontWeight: 500, color: '#8A7D70' }}>: {picked}</span> : null}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {availableValues(product, axis.name, selected).map(({ value, exists, soldOut }) => {
                const on = picked === value;
                const off = !exists || soldOut;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onPick(axis.name, value)}
                    disabled={off}
                    aria-pressed={on}
                    aria-label={`${value}${soldOut ? ' (stok habis)' : !exists ? ' (tidak tersedia)' : ''}`}
                    style={{
                      borderRadius: 999,
                      padding: '9px 16px',
                      fontSize: 14,
                      fontWeight: 600,
                      border: `1.5px ${!exists ? 'dashed' : 'solid'} ${on ? '#D26E8E' : off ? '#EADFD0' : '#E4D6C0'}`,
                      background: on ? '#FDF0F4' : '#fff',
                      color: on ? '#B4557A' : off ? '#C4B8A8' : '#43382E',
                      textDecoration: soldOut ? 'line-through' : 'none',
                      cursor: off ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
