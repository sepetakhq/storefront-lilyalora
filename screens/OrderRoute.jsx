import { Suspense, lazy, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { Img, SIZES } from '../ui/Img.jsx';
import { CountdownClock } from '../ui/Countdown.jsx';
import { EmptyState, ErrorState, Skeleton } from '../ui/states.jsx';
import { useOrder } from '../hooks/queries.js';
import { useConfig } from '../config/ConfigProvider.jsx';
import { serverNow } from '../api/client.js';
import { fmt, fmtDateTime } from '../shared/format.js';
import { isQrisPayload, isUsableRedirect } from '../lib/payment.js';
import { useToast } from '../ui/ToastProvider.jsx';

const QrCode = lazy(() => import('../ui/QrCode.jsx'));

const card = { background: '#fff', border: '1px solid #F0E4CF', borderRadius: 22, padding: 22 };

// Six statuses, not the prototype's four.
const STATUS_TONE = {
  awaiting_payment: { bg: '#FDF6E3', fg: '#8A6D1F' },
  processing: { bg: '#FDF0F4', fg: '#B4557A' },
  shipped: { bg: '#EAF3EC', fg: '#3E7D4E' },
  completed: { bg: '#EAF3EC', fg: '#3E7D4E' },
  cancelled: { bg: '#F4EFEA', fg: '#8A7D70' },
  expired: { bg: '#F4EFEA', fg: '#8A7D70' },
};

export default function OrderRoute() {
  const { token } = useParams();
  const location = useLocation();
  const justPlaced = Boolean(location.state?.justPlaced);
  const tokenAtRisk = Boolean(location.state?.tokenAtRisk);

  const { data, isPending, isError, error, refetch } = useOrder(token, { poll: true });

  if (isPending) return <OrderSkeleton />;

  if (isError) {
    // An unknown, malformed or wrong-case token is an ordinary 404 — the API
    // deliberately makes a nonexistent order indistinguishable from a bad token.
    if (error?.status === 404) {
      return (
        <main style={{ flex: 1, padding: '60px 20px' }}>
          <EmptyState
            title="Pesanan tidak ditemukan"
            body="Tautan lacak ini tidak cocok dengan pesanan mana pun. Periksa kembali tautan di email konfirmasimu."
            action={
              <Link to="/lacak" className="hv-dark" style={darkButton}>
                Cari pesanan
              </Link>
            }
          />
        </main>
      );
    }
    return (
      <main style={{ flex: 1, padding: '60px 20px' }}>
        <ErrorState error={error} onRetry={refetch} title="Pesanan gagal dimuat" />
      </main>
    );
  }

  const { order, payment } = data;
  const awaiting = order.status === 'awaiting_payment';

  return (
    <main
      aria-label="Pesanan"
      style={{ flex: 1, maxWidth: 720, margin: '0 auto', padding: '36px 20px 60px', width: '100%' }}
    >
      {justPlaced ? <PlacedBanner order={order} tokenAtRisk={tokenAtRisk} token={token} /> : null}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 600, margin: 0 }}>
          {order.number}
        </h1>
        <StatusPill status={order.status} label={order.status_label} />
      </div>
      <p style={{ color: '#8A7D70', fontSize: 13.5, margin: '6px 0 24px' }}>
        Dipesan {fmtDateTime(order.placed_at)} · {order.customer_name} · {order.city}
      </p>

      {awaiting ? <PaymentPanel order={order} payment={payment} onRefresh={refetch} /> : null}

      <Timeline order={order} />

      <section style={{ ...card, marginTop: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Rincian</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {order.lines.map((l, i) => (
            <div key={`${l.name}-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 44, flexShrink: 0 }}>
                <Img
                  src={l.image}
                  srcSet={l.image_srcset}
                  sizes={SIZES.summaryLine}
                  alt={l.name}
                  ratio="44/54"
                  radius={8}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                <div style={{ fontWeight: 600 }}>{l.name}</div>
                <div style={{ color: '#8A7D70', fontSize: 13 }}>
                  {fmt(l.unit_price)} × {l.qty}
                </div>
              </div>
              <strong style={{ fontSize: 14 }}>{fmt(l.line_total)}</strong>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #F0E4CF', marginTop: 16, paddingTop: 14, display: 'grid', gap: 8 }}>
          <Row label="Subtotal" value={fmt(order.subtotal)} />
          {/*
            The footer has to add up, so an order placed with a cart promotion
            shows what came off. Both rows appear only when there is something
            to say, which for most orders is neither.
          */}
          {order.discount_total > 0 ? (
            <Row
              label={order.promotion_name ? `Diskon · ${order.promotion_name}` : 'Diskon'}
              value={`−${fmt(order.discount_total)}`}
            />
          ) : null}
          <Row
            label={
              order.shipping_promotion_name
                ? `Ongkir · ${order.courier_code} · ${order.shipping_promotion_name}`
                : `Ongkir · ${order.courier_code}`
            }
            // Net, on one row: the buyer does not care what the courier
            // charges us, and free-by-threshold and free-by-promotion are the
            // same thing to them. The promotion's name on the label is what
            // keeps the "why".
            value={
              order.shipping_cost - order.shipping_discount === 0
                ? 'Gratis'
                : fmt(order.shipping_cost - order.shipping_discount)
            }
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700 }}>
            <span>Total</span>
            <span style={{ color: '#D26E8E' }}>{fmt(order.total)}</span>
          </div>
        </div>
        {order.awb ? (
          <div style={{ marginTop: 16, fontSize: 14 }}>
            Nomor resi <strong>{order.awb}</strong> · {order.courier_code}
          </div>
        ) : null}
      </section>
    </main>
  );
}

/**
 * Payment instructions.
 *
 * There is no push and no public payment-status endpoint, so this screen
 * learns about a successful payment only by polling the order. `useOrder`
 * owns that; this component owns what the buyer does in the meantime.
 */
function PaymentPanel({ order, payment, onRefresh }) {
  const { brand, payment: payConfig } = useConfig();
  const showToast = useToast();
  const [pastDeadline, setPastDeadline] = useState(
    () => Boolean(order.expires_at) && serverNow() > Date.parse(order.expires_at),
  );

  // The order exists and is valid; only the instructions are missing. There is
  // no endpoint to create an intent, and the stub's unique gateway reference
  // means one never can be — so this offers a person, not a retry button.
  if (!payment) {
    return (
      <section style={{ ...card, borderColor: '#F3D3DE', background: '#FDF0F4', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
          Instruksi pembayaran belum tersedia
        </div>
        <p style={{ fontSize: 14, color: '#6E5B45', lineHeight: 1.7, margin: 0 }}>
          Pesananmu tersimpan dengan nomor <strong>{order.number}</strong>, tapi instruksi
          pembayarannya gagal dibuat. Hubungi kami dan sebutkan nomor itu — kami bantu selesaikan.
        </p>
        {brand.whatsapp_url ? (
          <a
            href={brand.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hv-dark"
            style={{ ...darkButton, marginTop: 16 }}
          >
            {brand.whatsapp_text || 'Hubungi kami'}
          </a>
        ) : null}
      </section>
    );
  }

  // Past the deadline the worker sweeps once a minute, so the order still
  // reads awaiting_payment for up to a minute. Saying "expired" here would be
  // a lie to anyone whose payment landed seconds before the deadline.
  if (pastDeadline) {
    return (
      <section style={{ ...card, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Waktu pembayaran habis</div>
        <p style={{ fontSize: 14, color: '#8A7D70', lineHeight: 1.7, margin: '8px 0 0' }}>
          Sedang memeriksa status terakhir pesananmu…
        </p>
        <span className="la-shimmer" style={{ display: 'block', height: 4, borderRadius: 999, marginTop: 16 }} />
      </section>
    );
  }

  const copy = (value, label) => {
    navigator.clipboard?.writeText(value).then(
      () => showToast(`${label} disalin ✓`),
      () => showToast('Gagal menyalin'),
    );
  };

  return (
    <section style={{ ...card, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Selesaikan pembayaran</div>
        {order.expires_at ? (
          <div style={{ fontSize: 13, color: '#C05C7E', fontWeight: 600 }}>
            Sisa <CountdownClock until={order.expires_at} onExpire={() => setPastDeadline(true)} />
          </div>
        ) : null}
      </div>

      <div style={{ fontSize: 26, fontWeight: 700, color: '#D26E8E', margin: '10px 0 18px' }}>
        {fmt(payment.amount)}
      </div>

      {/* Branch on `kind`, never on `method`: the gateway decides which fields
          it populates, and a method can change kind under us. */}
      {payment.kind === 'va' ? (
        <div>
          <div style={{ fontSize: 13, color: '#8A7D70' }}>Transfer ke Virtual Account {payment.va_bank}</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: '#FDF6E3',
              border: '1px solid #F0E4CF',
              borderRadius: 14,
              padding: '14px 16px',
              marginTop: 8,
            }}
          >
            <strong style={{ fontSize: 19, letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
              {payment.va_number}
            </strong>
            <button
              type="button"
              onClick={() => copy(payment.va_number, 'Nomor VA')}
              style={{ color: '#B4557A', fontWeight: 700, fontSize: 13.5 }}
            >
              Salin
            </button>
          </div>
          {/* Rendered verbatim: the tenant writes this line in full, prefix
              included, so adding our own "a.n." doubles it. */}
          {payConfig.account_holder ? (
            <div style={{ fontSize: 13, color: '#8A7D70', marginTop: 10 }}>
              {payConfig.account_holder}
            </div>
          ) : null}
        </div>
      ) : payment.kind === 'qr' ? (
        <QrisBlock payload={payment.qr_payload} config={payConfig} brand={brand} />
      ) : payment.kind === 'redirect' ? (
        <RedirectBlock url={payment.redirect_url} order={order} brand={brand} />
      ) : (
        // No kind at all: the intent carries none of the three payloads, which
        // means the gateway answered with something we could not render.
        <div style={{ fontSize: 14, color: '#6E5B45', lineHeight: 1.7 }}>
          Metode pembayaran ini belum aktif. Hubungi kami untuk menyelesaikan pesanan{' '}
          <strong>{order.number}</strong>.
          {brand.whatsapp_url ? (
            <>
              <br />
              <a href={brand.whatsapp_url} target="_blank" rel="noopener noreferrer" style={{ color: '#B4557A', fontWeight: 700 }}>
                {brand.whatsapp_text || 'Hubungi kami'}
              </a>
            </>
          ) : null}
        </div>
      )}

      <div style={{ borderTop: '1px solid #F0E4CF', marginTop: 18, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: '#B7AA9A' }}>
          Halaman ini memperbarui sendiri setelah pembayaranmu masuk.
        </span>
        <button type="button" onClick={onRefresh} style={{ fontSize: 13, fontWeight: 600, color: '#B4557A' }}>
          Cek sekarang
        </button>
      </div>
    </section>
  );
}

/**
 * E-wallet and retail methods are completed on the provider's own page.
 *
 * The buyer leaves the site here, so this is also the last thing they see
 * before returning: the order number is spelled out so they can find the order
 * again from /lacak, which is where the provider sends them back to. It is
 * deliberately not a link carrying the tracking token — that token is issued
 * once, kept only as a hash, and must never travel to a third party.
 *
 * The stub's redirect points at a route that does not exist, so it is shown as
 * an inert test panel rather than a button that goes nowhere.
 */
function RedirectBlock({ url, order, brand }) {
  if (!isUsableRedirect(url)) {
    return (
      <div style={{ background: '#FDF6E3', border: '1px dashed #E0C98A', borderRadius: 16, padding: '18px 20px' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Mode uji</div>
        <p style={{ fontSize: 13.5, color: '#6E5B45', lineHeight: 1.7, margin: '8px 0 0' }}>
          Metode ini belum terhubung ke penyedia pembayaran, jadi belum ada halaman yang bisa
          dibuka. Hubungi kami untuk menyelesaikan pesanan <strong>{order.number}</strong>.
        </p>
        {brand.whatsapp_url ? (
          <a
            href={brand.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', marginTop: 12, color: '#B4557A', fontWeight: 700, fontSize: 13.5 }}
          >
            {brand.whatsapp_text || 'Hubungi kami'}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <a href={url} rel="noopener noreferrer" className="hv-dark" style={{ ...darkButton, textAlign: 'center' }}>
        Lanjut ke halaman pembayaran
      </a>
      <p style={{ fontSize: 13, color: '#8A7D70', lineHeight: 1.7, margin: '12px 0 0' }}>
        Kamu akan diarahkan ke halaman penyedia pembayaran. Setelah selesai, kembali ke sini —
        halaman ini memperbarui sendiri begitu pembayaranmu masuk. Nomor pesananmu{' '}
        <strong style={{ color: '#43382E' }}>{order.number}</strong>.
      </p>
    </div>
  );
}

function QrisBlock({ payload, config, brand }) {
  if (!isQrisPayload(payload)) {
    return (
      <div
        style={{
          background: '#FDF6E3',
          border: '1px dashed #E0C98A',
          borderRadius: 16,
          padding: '18px 20px',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14 }}>QRIS mode uji</div>
        <p style={{ fontSize: 13.5, color: '#6E5B45', lineHeight: 1.7, margin: '8px 0 0' }}>
          Pembayaran QRIS belum aktif di toko ini, jadi belum ada kode yang bisa dipindai. Hubungi
          kami untuk menyelesaikan pesanan.
        </p>
        {brand.whatsapp_url ? (
          <a
            href={brand.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', marginTop: 12, color: '#B4557A', fontWeight: 700, fontSize: 13.5 }}
          >
            {brand.whatsapp_text || 'Hubungi kami'}
          </a>
        ) : null}
        <code style={{ display: 'block', marginTop: 14, fontSize: 11, color: '#B7AA9A', wordBreak: 'break-all' }}>
          {payload}
        </code>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <Suspense fallback={<Skeleton width={220} height={220} radius={16} />}>
        <QrCode payload={payload} />
      </Suspense>
      <div style={{ fontSize: 13.5, color: '#8A7D70', lineHeight: 1.8 }}>
        Pindai dengan aplikasi bank atau e-wallet apa pun.
        {config.qris_merchant_name ? (
          <>
            <br />
            <strong style={{ color: '#43382E' }}>{config.qris_merchant_name}</strong>
          </>
        ) : null}
        {config.qris_nmid ? (
          <>
            <br />
            NMID {config.qris_nmid}
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Rendered from `order.timeline`, never recomputed from `status`: a cancelled
 * or expired order legitimately has all four steps undone, and deriving the
 * timeline locally would wrongly show the first one complete.
 */
function Timeline({ order }) {
  const terminal = order.status === 'cancelled' || order.status === 'expired';

  return (
    <section style={card}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Status</div>
      {terminal ? (
        <p style={{ fontSize: 14, color: '#8A7D70', lineHeight: 1.7, margin: '0 0 18px' }}>
          {order.status === 'expired'
            ? 'Pesanan ini kedaluwarsa karena pembayaran tidak masuk tepat waktu. Stoknya sudah dikembalikan.'
            : 'Pesanan ini dibatalkan.'}
        </p>
      ) : null}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {order.timeline.map((step, i) => (
          <li key={step.key} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch' }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: step.done ? '#D26E8E' : '#fff',
                  border: `2px solid ${step.done ? '#D26E8E' : '#E4DACB'}`,
                  flexShrink: 0,
                  marginTop: 3,
                }}
              />
              {i < order.timeline.length - 1 ? (
                <span style={{ flex: 1, width: 2, background: step.done ? '#F3B8C8' : '#F0E4CF', minHeight: 26 }} />
              ) : null}
            </div>
            <div style={{ paddingBottom: 18 }}>
              <div style={{ fontWeight: step.done ? 700 : 500, color: step.done ? '#43382E' : '#B7AA9A', fontSize: 14.5 }}>
                {step.label}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {terminal ? (
        <Link to="/katalog" className="hv-dark" style={darkButton}>
          Belanja lagi
        </Link>
      ) : null}
    </section>
  );
}

function PlacedBanner({ order, tokenAtRisk, token }) {
  return (
    <div
      style={{
        background: '#EAF3EC',
        border: '1px solid #CBE2D2',
        borderRadius: 18,
        padding: '16px 20px',
        marginBottom: 22,
      }}
    >
      <strong style={{ fontSize: 15 }}>Pesanan berhasil dibuat ✓</strong>
      <p style={{ fontSize: 13.5, color: '#4A6B55', lineHeight: 1.7, margin: '6px 0 0' }}>
        Tautan pesanan ini juga kami kirim ke {order.contact_masked}.
      </p>
      {/* Storage refused the write, so this page is the only place the token
          exists. Say so plainly rather than let it vanish on the next tap. */}
      {tokenAtRisk ? (
        <p style={{ fontSize: 13, color: '#8A5A2B', lineHeight: 1.7, margin: '10px 0 0' }}>
          Simpan tautan ini — peramban tidak bisa menyimpannya di perangkatmu:
          <br />
          <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{`${window.location.origin}/pesanan/${token}`}</code>
        </p>
      ) : null}
    </div>
  );
}

function StatusPill({ status, label }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.cancelled;
  return (
    <span
      style={{
        background: tone.bg,
        color: tone.fg,
        borderRadius: 999,
        padding: '6px 14px',
        fontSize: 12.5,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5 }}>
      <span style={{ color: '#8A7D70' }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const darkButton = {
  display: 'inline-block',
  background: '#43382E',
  color: '#FFFDF7',
  borderRadius: 999,
  padding: '13px 28px',
  fontWeight: 700,
  fontSize: 14.5,
  marginTop: 16,
};

function OrderSkeleton() {
  return (
    <main aria-busy="true" style={{ flex: 1, maxWidth: 720, margin: '0 auto', padding: '36px 20px 60px', width: '100%' }}>
      <Skeleton height={36} width={220} />
      <Skeleton height={14} width={300} style={{ marginTop: 12 }} />
      <Skeleton height={180} radius={22} style={{ marginTop: 26 }} />
      <Skeleton height={220} radius={22} style={{ marginTop: 20 }} />
    </main>
  );
}
