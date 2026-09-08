import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Img, SIZES } from '../ui/Img.jsx';
import OtpModal from '../components/OtpModal.jsx';
import DestinationPicker from '../components/DestinationPicker.jsx';
import ShippingRates from '../components/ShippingRates.jsx';
import { orderNote } from '../lib/preorder.js';
import { MAX_VOUCHER_LEN, normalizeVoucherInput, voucherLabel, voucherNotes } from '../lib/voucher.js';
import { destinationSummary } from '../lib/shipping.js';
import { useCart } from '../cart/CartProvider.jsx';
import { useCartLines } from '../cart/useCartLines.js';
import { useConfig } from '../config/ConfigProvider.jsx';
import { createDraft, sendCheckoutCode, verifyCheckoutCode } from '../api/endpoints.js';
import { qk } from '../api/queryKeys.js';
import { fmt } from '../shared/format.js';
import { contactField, normalizeContact, validateContact } from '../lib/contact.js';
import { clearCheckout, keyForAttempt, resetKeyForAttempt, saveCheckout } from '../checkout/checkoutStorage.js';
import { recordRetryAfter, recordSend, clearCooldown } from '../checkout/otpCooldown.js';
import { rememberOrder } from '../checkout/orderTokens.js';
import { CountdownClock } from '../ui/Countdown.jsx';

const card = { background: '#fff', border: '1px solid #F0E4CF', borderRadius: 22, padding: 22 };
const cardTitle = { fontWeight: 700, fontSize: 16, marginBottom: 14 };
const field = {
  border: '1px solid #F0E4CF',
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: 14.5,
  background: '#FFFDF7',
  width: '100%',
};

// Server-side caps, counted in runes. Enforced here so the buyer is told
// before a round-trip, not after.
const LIMITS = { customer_name: 120, address: 500, city: 80, contact: 254 };

export default function CheckoutRoute() {
  const cart = useCart();
  // Placing an order empties the cart, which would otherwise trip this guard
  // and bounce the buyer to an empty cart instead of their new order — with
  // the order created and the tracking link only in localStorage.
  const [placed, setPlaced] = useState(false);
  if (cart.isEmpty && !placed) return <Navigate to="/keranjang" replace />;
  return <Checkout onPlaced={() => setPlaced(true)} />;
}

function Checkout({ onPlaced }) {
  const { couriers, paymentMethods, contactChannel, freeShipping, freeShippingMin, liveShipping } =
    useConfig();
  const cart = useCart();
  const { lines, subtotal, isLoading, hasBlockers, preorderLeadDays } = useCartLines();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ customer_name: '', contact: '', address: '', city: '' });
  const [courier, setCourier] = useState(() => couriers[0]?.code ?? '');
  const [method, setMethod] = useState(() => paymentMethods[0]?.code ?? '');
  const [formErr, setFormErr] = useState('');

  // Live rates only. `destination` is the resolved location the provider
  // quotes to, and `quote` is the option the buyer picked — checkout submits
  // its id, never a price, because the server charges what it stored.
  const [destination, setDestination] = useState(null);
  const [quote, setQuote] = useState(null);

  // The draft is the first server-priced view of this cart, and the review
  // step exists so the buyer approves it before a code is spent.
  const [draft, setDraft] = useState(null);
  // Kept on the checkout screen, not in the cart: a code belongs to this
  // attempt at paying, and one left in localStorage would come back weeks
  // later as a discount the buyer never asked for again. It survives "Ubah
  // pesanan" because that only clears the draft, not this.
  const [voucherCode, setVoucherCode] = useState('');
  const [otp, setOtp] = useState(null);
  // Closing the modal must not discard the challenge. The buyer still has a
  // live code in their inbox, and re-sending would spend one of five per hour
  // and push them onto the 60s -> 5m -> 30m ladder for no reason.
  const [otpOpen, setOtpOpen] = useState(false);

  const contactMeta = contactField(contactChannel);
  const setField = (e) => {
    // Clear the banner as soon as the buyer starts fixing it — leaving it up
    // while they type reads as though the correction did not register.
    setFormErr('');
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  // Prices the cart last saw, for the change notice on the review panel.
  const cartPrices = useMemo(() => {
    const m = new Map();
    for (const l of lines) if (l.product) m.set(l.product.id, l.product.price);
    return m;
  }, [lines]);

  const cartItems = useMemo(
    () => cart.items.map((it) => ({ product_id: it.productId, qty: it.qty })),
    [cart.items],
  );

  const draftMutation = useMutation({
    mutationFn: () =>
      createDraft({
        items: cartItems,
        // Under live rates the quote carries the courier and the price, so
        // courier_code is not read; under flat pricing there is no quote and
        // the code is the whole answer. Sending both is harmless and keeps
        // one call site.
        courier_code: courier,
        shipping_quote_id: quote?.quote_id ?? '',
        payment_method: method,
        contact: normalizeContact(contactChannel, form.contact),
        customer_name: form.customer_name.trim(),
        address: form.address.trim(),
        // The city the order is filed under. Under live rates it comes from
        // the resolved destination, so an operator reads the same place the
        // parcel was quoted to rather than whatever the buyer typed.
        city: liveShipping ? destinationSummary(destination) : form.city.trim(),
        // Empty when they typed nothing, which is the ordinary case. The
        // server answers on the draft rather than refusing it, so a bad code
        // never costs the buyer the order.
        voucher_code: voucherCode,
      }),
    onSuccess: (d) => {
      setFormErr('');
      setDraft(d);
      saveCheckout({ draftId: d.draft_id, expiresAt: d.expires_at });
      clearCooldown(d.draft_id);
    },
    onError: (err) => handleDraftError(err),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendCheckoutCode(draft.draft_id),
    onSuccess: (res) => {
      const state = recordSend(draft.draft_id);
      setOtpOpen(true);
      setOtp({
        channel: res.channel,
        masked: res.masked,
        expiresAt: new Date(Date.now() + res.expires_in_seconds * 1000).toISOString(),
        nextAllowedAt: state.nextAllowedAt,
        attempts: 0,
        error: '',
      });
    },
    onError: (err) => handleSendError(err),
  });

  const verifyMutation = useMutation({
    mutationFn: async (code) => {
      const key = keyForAttempt(draft.draft_id, code);
      try {
        return await verifyCheckoutCode(draft.draft_id, code, key);
      } catch (err) {
        // A reused key with a different body is our bug, not the buyer's.
        // Mint a fresh one and try once more, transparently.
        if (err?.status === 422) {
          return verifyCheckoutCode(draft.draft_id, code, resetKeyForAttempt(draft.draft_id, code));
        }
        throw err;
      }
    },
    onSuccess: ({ data }) => {
      // Before navigating, before setState, before anything that can throw:
      // the track token is returned exactly once and no endpoint can give it
      // back — not tracking, not the OTP lookup.
      const saved = rememberOrder({
        token: data.track_token,
        number: data.order.number,
        total: data.order.total,
        placedAt: data.order.placed_at,
      });

      queryClient.setQueryData(qk.track(data.track_token), {
        order: data.order,
        payment: data.payment ?? null,
      });

      // Order matters: release the empty-cart guard before emptying the cart,
      // then navigate. All three are batched into one render.
      onPlaced();
      clearCheckout();
      clearCooldown(draft.draft_id);
      cart.clear();
      setOtp(null);
      setOtpOpen(false);

      navigate(`/pesanan/${data.track_token}`, {
        replace: true,
        state: { justPlaced: true, tokenAtRisk: !saved },
      });
    },
    onError: (err) => handleVerifyError(err),
  });

  function handleDraftError(err) {
    if (err?.status === 409 && err.code === 'unavailable') {
      // The API drops the per-item detail, so the cart refetches and lets the
      // per-line hydration surface which product is the problem.
      queryClient.invalidateQueries({ queryKey: ['product'] });
      navigate('/keranjang', { state: { stockChanged: true } });
      return;
    }
    setFormErr(err?.message || 'Checkout gagal. Coba lagi.');
  }

  function handleSendError(err) {
    if (err?.code === 'draft_expired') return resetDraft('Checkout kedaluwarsa. Ulangi ya.');
    if (err?.code === 'draft_consumed' || err?.code === 'order_exists') {
      return setFormErr('Pesanan ini sudah dibuat. Cek email konfirmasimu atau buka Lacak Pesanan.');
    }
    if (err?.status === 409 && err.code === 'unavailable') return handleDraftError(err);
    if (err?.status === 429) {
      if (err.retryAfter) recordRetryAfter(draft.draft_id, err.retryAfter);
      setFormErr(err.message);
      return;
    }
    setFormErr(err?.message || 'Gagal mengirim kode.');
  }

  function handleVerifyError(err) {
    // Wrong code, expired code, too many attempts and a code bound to another
    // draft are one indistinguishable 400 by design — so the UI must not
    // promise a reason.
    if (err?.status === 400) {
      setOtp((o) => o && { ...o, error: err.message, attempts: o.attempts + 1 });
      return;
    }
    if (err?.status === 409 && err.code === 'unavailable') {
      // The OTP was consumed before the stock check, so a retry is useless —
      // this needs a new draft and a new code.
      setOtp(null);
      setOtpOpen(false);
      queryClient.invalidateQueries({ queryKey: ['product'] });
      navigate('/keranjang', { state: { stockChanged: true, afterVerify: true } });
      return;
    }
    if (err?.code === 'order_exists' || err?.code === 'draft_consumed') {
      setOtp(null);
      setOtpOpen(false);
      setFormErr('Pesanan ini sudah dibuat. Cek email konfirmasimu atau buka Lacak Pesanan.');
      return;
    }
    setOtp((o) => o && { ...o, error: err?.message || 'Verifikasi gagal. Coba lagi.' });
  }

  function resetDraft(message) {
    setDraft(null);
    setOtp(null);
    setOtpOpen(false);
    clearCheckout();
    setFormErr(message);
  }

  function submitForm(e) {
    e.preventDefault();
    for (const [key, max] of Object.entries(LIMITS)) {
      if ([...(form[key] || '')].length > max) {
        return setFormErr(`${LABELS[key]} terlalu panjang (maksimal ${max} karakter).`);
      }
    }
    // Every empty required field named at once, contact included. It used to
    // be left out of this check and validated three lines further down, so a
    // buyer filling an empty form was told to complete three fields, did, and
    // only then discovered a fourth.
    const missing = missingFields({
      form,
      liveShipping,
      destination,
      contactLabel: contactField(contactChannel).label,
    });
    if (missing.length > 0) {
      return setFormErr(`Lengkapi ${listPhrase(missing)} dulu ya.`);
    }
    // No fallback to a flat rate: charging one the buyer was never shown is
    // worse than asking them to pick again.
    if (liveShipping && !quote) {
      return setFormErr('Pilih ongkir dulu ya.');
    }
    // Reached only once contact holds something, so this is about the shape of
    // what was typed rather than its absence.
    const contactErr = validateContact(contactChannel, form.contact);
    if (contactErr) return setFormErr(contactErr);

    setFormErr('');
    draftMutation.mutate();
  }

  if (draft) {
    return (
      <Review
        draft={draft}
        cartPrices={cartPrices}
        // Under live rates the chosen quote names the service; the config's
        // courier list only carries the allow-list, not the price.
        courier={liveShipping ? quote : couriers.find((c) => c.code === courier)}
        method={paymentMethods.find((m) => m.code === method)}
        error={formErr}
        otp={otp}
        otpOpen={otpOpen}
        sending={sendMutation.isPending}
        verifying={verifyMutation.isPending}
        onSend={() => {
          setFormErr('');
          sendMutation.mutate();
        }}
        onReopenOtp={() => {
          setFormErr('');
          setOtpOpen(true);
        }}
        onVerify={(code) => verifyMutation.mutate(code)}
        onCancelOtp={() => setOtpOpen(false)}
        onEdit={() => resetDraft('')}
        onExpire={() => resetDraft('Checkout kedaluwarsa. Ulangi ya.')}
      />
    );
  }

  // Under live rates the chosen quote is the estimate, and it is a real
  // quoted price rather than a mirror of a server rule — so the summary can
  // say so instead of hedging.
  const free = { enabled: freeShipping, min: freeShippingMin };
  const estShipping = liveShipping
    ? estimateShipping(subtotal, quote ? { cost: quote.cost } : null, free)
    : estimateShipping(subtotal, couriers.find((c) => c.code === courier), free);

  // The order value a fee and a channel's bounds apply to: goods plus ongkir,
  // before the fee itself. Advisory, like everything on this side of the
  // draft, and it is what the tiles are measured against.
  const estBase = subtotal + estShipping;
  const estFee = estimatePaymentFee(estBase, paymentMethods.find((p) => p.code === method));

  return (
    <main
      aria-label="Checkout"
      style={{ flex: 1, maxWidth: 1100, margin: '0 auto', padding: '36px 20px 60px', width: '100%' }}
    >
      <h1 style={pageTitle}>Checkout</h1>

      {/* noValidate, deliberately: the browser's own constraint bubble fires
          before onSubmit and speaks the browser's language, so an Indonesian
          storefront was showing "Please include an '@' in the email address".
          type="email" is kept for the mobile keyboard; the message now comes
          from validateContact, which mirrors the server's wording exactly. */}
      <form
        noValidate
        onSubmit={submitForm}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}
      >
        <div style={{ flex: '1 1 480px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <section style={card}>
            <div style={cardTitle}>1 · Alamat pengiriman</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
              <input
                name="customer_name"
                value={form.customer_name}
                onChange={setField}
                placeholder="Nama lengkap"
                aria-label="Nama lengkap"
                autoComplete="name"
                maxLength={LIMITS.customer_name}
                style={field}
              />
              <input
                name="contact"
                value={form.contact}
                onChange={setField}
                placeholder={contactMeta.placeholder}
                aria-label={contactMeta.label}
                type={contactMeta.type}
                inputMode={contactMeta.inputMode}
                autoComplete={contactMeta.autoComplete}
                maxLength={LIMITS.contact}
                style={field}
              />
            </div>
            <textarea
              name="address"
              value={form.address}
              onChange={setField}
              placeholder="Alamat lengkap"
              aria-label="Alamat lengkap"
              autoComplete="street-address"
              maxLength={LIMITS.address}
              rows={3}
              style={{ ...field, marginTop: 12, resize: 'vertical' }}
            />
            {liveShipping ? (
              // The provider quotes from a location id, not from an address,
              // so a free-text city cannot reach it. Picking here is what
              // makes a price exist at all.
              <DestinationPicker
                value={destination}
                onChange={(d) => {
                  setFormErr('');
                  setDestination(d);
                  // The old quote priced a different route. Dropping it means
                  // the buyer re-picks while looking at the new list, rather
                  // than being refused one screen later.
                  setQuote(null);
                }}
              />
            ) : (
              <input
                name="city"
                value={form.city}
                onChange={setField}
                placeholder="Kota"
                aria-label="Kota"
                autoComplete="address-level2"
                maxLength={LIMITS.city}
                style={{ ...field, marginTop: 12 }}
              />
            )}
            <p style={{ fontSize: 12.5, color: '#B7AA9A', margin: '10px 0 0' }}>
              Kode verifikasi dikirim ke {contactMeta.noun} ini.
            </p>
          </section>

          <section style={card}>
            <div style={cardTitle}>2 · Pengiriman</div>
            {liveShipping ? (
              <ShippingRates
                destination={destination}
                items={cartItems}
                selected={quote?.quote_id ?? ''}
                onSelect={setQuote}
                onRetry={() => {
                  setDestination(null);
                  setQuote(null);
                }}
              />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {couriers.map((c) => (
                  <OptionTile key={c.code} selected={courier === c.code} onClick={() => setCourier(c.code)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span>
                        <strong>{c.name}</strong>
                        <span style={{ color: '#8A7D70', fontSize: 13 }}> · {c.eta}</span>
                      </span>
                      <strong>{fmt(c.cost)}</strong>
                    </div>
                  </OptionTile>
                ))}
              </div>
            )}
          </section>

          <section style={card}>
            <div style={cardTitle}>3 · Pembayaran</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {paymentMethods.map((p) => {
                const fits = methodFits(p, estBase);
                const fee = estimatePaymentFee(estBase, p);
                return (
                  <OptionTile
                    key={p.code}
                    selected={method === p.code}
                    disabled={!fits}
                    onClick={() => fits && setMethod(p.code)}
                  >
                    <strong>{p.name}</strong>
                    <div style={{ color: '#8A7D70', fontSize: 13 }}>
                      {p.sub}
                      {fee > 0 ? ` · biaya admin ${fmt(fee)}` : ''}
                    </div>
                    {/*
                      Said here rather than after the draft is built: the
                      server refuses an out-of-range total too, but by then the
                      buyer has spent a verification code to find out.
                    */}
                    {!fits ? (
                      <div style={{ color: '#B7573C', fontSize: 12.5, marginTop: 2 }}>
                        {outOfRangeReason(p, estBase)}
                      </div>
                    ) : null}
                  </OptionTile>
                );
              })}
            </div>
          </section>

          {/*
            Optional, and last: a code is something a buyer either has or does
            not, and putting it above the address would have everyone else
            wondering whether they were missing one.

            Whether it works is answered on the next screen, beside the total
            it changes, rather than here. The server prices the code against
            the finished cart -- after line discounts, after the free-shipping
            rule -- so anything this field could say on its own would be a
            guess that the summary might then contradict.
          */}
          <section style={card}>
            <div style={cardTitle}>4 · Punya kode voucher?</div>
            <input
              value={voucherCode}
              onChange={(e) => setVoucherCode(normalizeVoucherInput(e.target.value))}
              maxLength={MAX_VOUCHER_LEN}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Masukkan kode"
              aria-label="Kode voucher"
              style={{ ...field, textTransform: 'uppercase', letterSpacing: 0.5 }}
            />
            <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#B7AA9A', lineHeight: 1.6 }}>
              Boleh dikosongkan. Potongannya muncul di ringkasan sebelum kamu bayar.
            </p>
          </section>
        </div>

        <aside style={{ ...card, flex: '1 1 300px', minWidth: 280, position: 'sticky', top: 90 }}>
          <div style={cardTitle}>Ringkasan</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {lines
              .filter((l) => l.product)
              .map((l) => (
                <div key={l.item.productId} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 44, flexShrink: 0 }}>
                    <Img
                      src={l.product.image}
                      srcSet={l.product.image_srcset}
                      sizes={SIZES.summaryLine}
                      alt={l.product.name}
                      ratio="44/54"
                      radius={8}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>
                    <div style={{ fontWeight: 600 }}>{l.product.name}</div>
                    <div style={{ color: '#8A7D70' }}>×{l.item.qty}</div>
                  </div>
                  <strong style={{ fontSize: 13.5 }}>{fmt(l.lineTotal)}</strong>
                </div>
              ))}
          </div>

          <SummaryRow label="Subtotal" value={fmt(subtotal)} />
          <SummaryRow
            label="Ongkir"
            value={
              liveShipping && !quote
                ? 'Belum dipilih'
                : estShipping === 0
                  ? 'Gratis'
                  : fmt(estShipping)
            }
          />
          {estFee > 0 ? <SummaryRow label="Biaya admin" value={fmt(estFee)} /> : null}
          <p style={{ fontSize: 12, color: '#B7AA9A', margin: '10px 0 0' }}>
            Perkiraan, termasuk biaya admin. Total pastinya muncul di langkah
            berikutnya.
          </p>

          {/* The wait, before the buyer commits to anything. Stated as a
              duration because no money has moved yet -- the clock starts at
              payment, so there is no date to give. */}
          {preorderLeadDays ? (
            <p style={{ fontSize: 12.5, fontWeight: 600, color: '#8A6D1F', margin: '10px 0 0' }}>
              {orderNote(preorderLeadDays)}.
            </p>
          ) : null}

          {/* Below the button, not above it. A message above pushed "Buat
              pesanan" down by its own height the instant it appeared — out
              from under the cursor that had just clicked it, so an impatient
              second click landed on nothing. role="alert" is what carries it
              to a screen reader, and that does not depend on being first. */}
          <button
            type="submit"
            className="hv-primary"
            disabled={draftMutation.isPending || isLoading || hasBlockers}
            style={{
              ...primaryButton,
              marginTop: 16,
              opacity: draftMutation.isPending || isLoading || hasBlockers ? 0.6 : 1,
            }}
          >
            {draftMutation.isPending ? 'Menghitung…' : 'Buat pesanan'}
          </button>

          {formErr ? (
            <div role="alert" style={errorBox}>
              {formErr}
            </div>
          ) : null}
        </aside>
      </form>
    </main>
  );
}

/**
 * The review step. Not optional: the draft is the first time the server prices
 * this cart, and it re-prices silently — there is no "price changed" field on
 * the wire. The buyer approves the real total here, before an OTP is spent,
 * and codes are capped at five per contact per hour.
 */
function Review({
  draft,
  cartPrices,
  courier,
  method,
  error,
  otp,
  otpOpen,
  sending,
  verifying,
  onSend,
  onReopenOtp,
  onVerify,
  onCancelOtp,
  onEdit,
  onExpire,
}) {
  // A code already sent and still inside its five-minute window is the one the
  // buyer should be typing, not a reason to request another.
  const liveCode = otp && Date.parse(otp.expiresAt) > Date.now();
  const changed = draft.lines.filter((l) => {
    const before = cartPrices.get(l.product_id);
    return before !== undefined && before !== l.unit_price;
  });

  return (
    <main
      aria-label="Konfirmasi pesanan"
      style={{ flex: 1, maxWidth: 640, margin: '0 auto', padding: '36px 20px 60px', width: '100%' }}
    >
      <h1 style={pageTitle}>Konfirmasi pesanan</h1>

      {changed.length > 0 ? (
        <div
          role="status"
          style={{
            background: '#FDF6E3',
            border: '1px solid #EFD98F',
            borderRadius: 16,
            padding: '14px 18px',
            marginBottom: 20,
          }}
        >
          <strong style={{ fontSize: 14.5 }}>Harga diperbarui</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5, color: '#6E5B45' }}>
            {changed.map((l) => (
              <li key={l.product_id}>
                {l.name}: {fmt(cartPrices.get(l.product_id))} → <strong>{fmt(l.unit_price)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section style={card}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {draft.lines.map((l) => (
            <div key={l.product_id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
                  {l.promotion_name ? (
                    <span style={{ color: '#D26E8E' }}> · {l.promotion_name}</span>
                  ) : null}
                </div>
              </div>
              <strong style={{ fontSize: 14 }}>{fmt(l.line_total)}</strong>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #F0E4CF', paddingTop: 14, display: 'grid', gap: 8 }}>
          <SummaryRow label="Subtotal" value={fmt(draft.subtotal)} />
          {/*
            Cart-scope promotions. The draft is the authority on all of this —
            the cart screen's own estimate does not know about them and will
            over-state, which is the safe direction for a surprise.
          */}
          {draft.discount_total > 0 ? (
            <SummaryRow
              label={voucherLabel(
                draft,
                draft.promotion_name ? `Diskon · ${draft.promotion_name}` : 'Diskon',
              )}
              value={`−${fmt(draft.discount_total)}`}
            />
          ) : null}
          <SummaryRow
            label={
              draft.shipping_promotion_name
                ? `Ongkir · ${courier?.name ?? ''} · ${draft.shipping_promotion_name}`
                : `Ongkir · ${courier?.name ?? ''}`
            }
            // Net, on one row: free-by-threshold and free-by-promotion are one
            // thing to the buyer.
            value={
              draft.shipping_cost - draft.shipping_discount === 0
                ? 'Gratis'
                : fmt(draft.shipping_cost - draft.shipping_discount)
            }
          />
          {/*
            One row, never the split between what the gateway takes and what
            the platform keeps — the buyer is paying one fee and has no use for
            its parts. Absent entirely when the shop absorbs the cost.
          */}
          {draft.payment_fee > 0 ? (
            <SummaryRow label="Biaya admin" value={fmt(draft.payment_fee)} />
          ) : null}
          {/*
            Shown here as well as on the order page, and for a reason beyond
            the footer adding up: this is the screen where the buyer decides
            the number is right. Meeting it for the first time in their banking
            app is how it gets rounded off.
          */}
          {draft.unique_code > 0 ? (
            <SummaryRow label="Kode unik" value={fmt(draft.unique_code)} />
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, marginTop: 4 }}>
            <span>Total</span>
            <span style={{ color: '#D26E8E' }}>{fmt(draft.total)}</span>
          </div>
          {/* From the draft, not the cart: this is the number the buyer is
              about to spend a verification code approving, and every other row
              in this block comes from the same place. */}
          {draft.preorder_lead_days > 0 ? (
            <p style={{ fontSize: 12.5, fontWeight: 600, color: '#8A6D1F', margin: '12px 0 0' }}>
              {orderNote(draft.preorder_lead_days)}.
            </p>
          ) : null}
          {/*
            What happened to the code they typed. Under the total rather than
            beside the field: a refused code and a code that cost them money
            both matter at the moment they decide this number is right, and
            neither has a rupiah value that belongs in a row.
          */}
          {voucherNotes(draft).map((n, i) => (
            <p
              key={`v${i}`}
              style={{
                margin: i === 0 ? '10px 0 0' : 0,
                fontSize: 12.5,
                lineHeight: 1.6,
                fontWeight: n.tone === 'warn' ? 600 : 400,
                color: n.tone === 'warn' ? '#8A6D1F' : '#B7AA9A',
              }}
            >
              {n.text}
            </p>
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: 13.5, color: '#8A7D70', lineHeight: 1.7 }}>
          Bayar dengan <strong style={{ color: '#43382E' }}>{method?.name}</strong>
          <br />
          Kode verifikasi dikirim ke <strong style={{ color: '#43382E' }}>{draft.contact.masked}</strong>
        </div>

        <div style={{ marginTop: 10, fontSize: 12.5, color: '#B7AA9A' }}>
          Berlaku <CountdownClock until={draft.expires_at} onExpire={onExpire} /> lagi
        </div>

        {error ? (
          <div role="alert" style={errorBox}>
            {error}
          </div>
        ) : null}

        <button
          type="button"
          className="hv-primary"
          onClick={liveCode ? onReopenOtp : onSend}
          disabled={sending}
          style={{ ...primaryButton, marginTop: 18, opacity: sending ? 0.6 : 1 }}
        >
          {sending ? 'Mengirim…' : liveCode ? 'Masukkan kode' : 'Kirim kode verifikasi'}
        </button>
        <button
          type="button"
          onClick={onEdit}
          style={{ width: '100%', marginTop: 10, fontSize: 14, fontWeight: 600, color: '#8A7D70' }}
        >
          Ubah pesanan
        </button>
      </section>

      {otp && otpOpen ? (
        <OtpModal
          otp={otp}
          draftId={draft.draft_id}
          verifying={verifying}
          onVerify={onVerify}
          onResend={onSend}
          resending={sending}
          onCancel={onCancelOtp}
        />
      ) : null}
    </main>
  );
}

function OptionTile({ selected, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      style={{
        textAlign: 'left',
        border: `2px solid ${selected ? '#D26E8E' : '#F0E4CF'}`,
        background: selected ? '#FDF0F4' : '#FFFDF7',
        borderRadius: 14,
        padding: '12px 14px',
        // Dimmed rather than hidden: a buyer whose cart is too large for a
        // virtual account needs to see that the method exists and why it is
        // unavailable, or they will look for it and conclude the shop is
        // broken.
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5 }}>
      <span style={{ color: '#8A7D70' }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/**
 * Mirrors the server's rule so the estimate does not contradict the draft.
 *
 * `free` is the whole offer -- `{ enabled, min }` -- because the threshold
 * alone cannot express a shop that has withdrawn it: a min of zero means every
 * order ships free, so "off" has to be its own flag on both sides of the wire.
 */
/**
 * What paying with this method will add, before the draft says for certain.
 *
 * A three-line mirror of payment.ChannelFee.On, rounding up for the same
 * reason it does. The rate the server sends is one combined number -- the
 * gateway's cut and the platform's margin already folded together -- and it is
 * rounded up to a whole basis point, so this lands a few rupiah *above* the
 * authoritative fee rather than below it. That direction is deliberate: a
 * buyer shown a slightly high estimate and then charged less has been treated
 * fairly, and the reverse has not.
 *
 * Advisory, exactly like estimateShipping. The number that actually charges
 * anyone comes from the draft.
 */
export function estimatePaymentFee(base, method) {
  const flat = method?.fee_flat ?? 0;
  const bps = method?.fee_basis_pt ?? 0;
  if (!flat && !bps) return 0;
  if (!(base > 0)) return flat;
  return flat + Math.ceil((base * bps) / 10000);
}

/**
 * Whether this cart is within what the method's channel accepts.
 *
 * The bounds arrive already expressed in order-value terms -- the server
 * inverts the gross-up in payment.MinBase and MaxBase -- so this compares like
 * with like and never has to reason about the fee itself. Zero means the
 * channel states no bound, which is not the same as a bound of nothing.
 */
export function methodFits(method, base) {
  if (!(base > 0)) return true;
  const min = method?.min_order_total ?? 0;
  const max = method?.max_order_total ?? 0;
  if (min > 0 && base < min) return false;
  if (max > 0 && base > max) return false;
  return true;
}

/** Why this cart cannot use this method, in the buyer's terms. */
export function outOfRangeReason(method, base) {
  const min = method?.min_order_total ?? 0;
  const max = method?.max_order_total ?? 0;
  if (min > 0 && base < min) return `Minimal ${fmt(min)} untuk metode ini.`;
  if (max > 0 && base > max) return `Maksimal ${fmt(max)} untuk metode ini.`;
  return '';
}

export function estimateShipping(subtotal, courier, free) {
  if (!courier) return 0;
  return free.enabled && subtotal >= free.min ? 0 : courier.cost;
}

const LABELS = {
  customer_name: 'Nama',
  address: 'Alamat',
  city: 'Kota',
  contact: 'Kontak',
};

/**
 * Which required fields are still empty, in the order they appear on screen.
 *
 * Exported for its own test: it is the part that decides what the buyer is
 * told, and it was wrong for as long as it was inline.
 *
 * The destination is a picked object under live rates and free text under flat
 * ones, so the two modes disagree on the label as well as the check.
 */
export function missingFields({ form, liveShipping, destination, contactLabel }) {
  const out = [];
  if (!form.customer_name.trim()) out.push(LABELS.customer_name.toLowerCase());
  if (!String(form.contact ?? '').trim()) out.push(contactLabel.toLowerCase());
  if (!form.address.trim()) out.push(LABELS.address.toLowerCase());
  if (liveShipping) {
    if (!destination) out.push('tujuan pengiriman');
  } else if (!form.city.trim()) {
    out.push(LABELS.city.toLowerCase());
  }
  return out;
}

/** "nama, alamat, dan kota" — an Indonesian list, serial "dan", no comma. */
export function listPhrase(items) {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} dan ${items[items.length - 1]}`;
}

const pageTitle = {
  fontFamily: "'Cormorant Garamond',serif",
  fontSize: 44,
  fontWeight: 600,
  margin: '0 0 24px',
};

const primaryButton = {
  width: '100%',
  background: '#D26E8E',
  color: '#fff',
  borderRadius: 999,
  padding: '15px 26px',
  fontWeight: 700,
  fontSize: 15,
};

const errorBox = {
  background: '#FDF0F4',
  border: '1px solid #F3D3DE',
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: 13.5,
  marginTop: 14,
  lineHeight: 1.6,
};
