import { Link } from 'react-router-dom';

import { Img, SIZES } from '../ui/Img.jsx';
import { EmptyState, InlineError, Skeleton } from '../ui/states.jsx';
import { useCart, MAX_QTY } from '../cart/CartProvider.jsx';
import { useCartLines } from '../cart/useCartLines.js';
import { useConfig } from '../config/ConfigProvider.jsx';
import { didPurgeLegacy } from '../lib/storage.js';
import { fmt } from '../shared/format.js';

export default function CartRoute() {
  const { freeShipping, freeShippingMin } = useConfig();
  const cart = useCart();
  const { lines, subtotal, isLoading, hasBlockers } = useCartLines();

  if (cart.isEmpty) {
    return (
      <main style={{ flex: 1, padding: '60px 20px' }}>
        <EmptyState
          title="Keranjangmu masih kosong"
          body={
            didPurgeLegacy()
              ? 'Keranjang lama direset karena katalognya sudah diperbarui. Pilih lagi koleksi favoritmu.'
              : 'Belum ada yang dipilih. Koleksi voal dan pashmina menunggu.'
          }
          action={
            <Link to="/katalog" className="hv-dark" style={darkButton}>
              Mulai belanja
            </Link>
          }
        />
      </main>
    );
  }

  const remaining = Math.max(0, freeShippingMin - subtotal);
  const pct = freeShippingMin ? Math.min(100, Math.round((subtotal / freeShippingMin) * 100)) : 100;

  return (
    <main
      aria-label="Keranjang"
      style={{ flex: 1, maxWidth: 900, margin: '0 auto', padding: '36px 20px 60px', width: '100%' }}
    >
      <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 40, fontWeight: 600, margin: '0 0 20px' }}>
        Keranjang
      </h1>

      {/* Nothing to make progress towards once the offer is switched off. */}
      {freeShipping && (
        <div
          style={{
            background: '#FDF6E3',
            border: '1px solid #F0E4CF',
            borderRadius: 16,
            padding: '14px 18px',
            marginBottom: 22,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>
            {remaining > 0
              ? `Belanja ${fmt(remaining)} lagi untuk gratis ongkir`
              : 'Selamat — pesananmu gratis ongkir 🎉'}
          </div>
          <div style={{ background: '#F0E4CF', borderRadius: 999, height: 6, marginTop: 10 }}>
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: '#D26E8E',
                borderRadius: 999,
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {lines.map((line) => (
          <CartLine key={line.item.productId} line={line} onQty={cart.setQty} onRemove={cart.remove} />
        ))}
      </div>

      <div
        style={{
          borderTop: '1px solid #F0E4CF',
          marginTop: 26,
          paddingTop: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <Row label="Subtotal" value={isLoading ? '…' : fmt(subtotal)} />
        <Row label="Ongkir" value="Dihitung saat checkout" muted />
        {/* The authoritative price appears once, at the draft. Saying so here
            is more honest than a total that can change at the next step. */}
        <p style={{ fontSize: 12.5, color: '#B7AA9A', margin: 0 }}>
          Total akhir, ongkir, dan diskon dihitung di langkah berikutnya.
        </p>

        {hasBlockers ? (
          <div
            role="alert"
            style={{
              background: '#FDF0F4',
              border: '1px solid #F3D3DE',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 13,
              marginTop: 4,
            }}
          >
            Ada produk yang sudah tidak tersedia. Hapus dulu sebelum lanjut ke checkout.
          </div>
        ) : null}

        <Link
          to="/checkout"
          className="hv-primary"
          aria-disabled={hasBlockers || isLoading}
          onClick={(e) => {
            if (hasBlockers || isLoading) e.preventDefault();
          }}
          style={{
            marginTop: 10,
            textAlign: 'center',
            background: hasBlockers || isLoading ? '#E4DACB' : '#D26E8E',
            color: hasBlockers || isLoading ? '#8A7D70' : '#fff',
            borderRadius: 999,
            padding: '15px 26px',
            fontWeight: 700,
            fontSize: 15,
            cursor: hasBlockers || isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          Lanjut ke Checkout
        </Link>
        <Link to="/katalog" className="hv-pink" style={{ textAlign: 'center', fontWeight: 600, fontSize: 14 }}>
          Lanjut belanja
        </Link>
      </div>
    </main>
  );
}

function CartLine({ line, onQty, onRemove }) {
  const { item, product, status, error, refetch, available } = line;
  const remove = () => onRemove(item.productId);

  if (status === 'loading') {
    return (
      <div style={{ ...card, alignItems: 'center' }}>
        <Skeleton ratio="72/90" radius={12} style={{ width: 72, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <Skeleton height={15} width="60%" />
          <Skeleton height={13} width="30%" style={{ marginTop: 10 }} />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={card}>
        <div style={{ flex: 1 }}>
          <InlineError error={error} onRetry={refetch} />
        </div>
      </div>
    );
  }

  // A 404 means the product was unpublished or deleted. The only useful action
  // left is removing it, so that is what the line offers.
  if (status === 'gone') {
    return (
      <div style={{ ...card, background: '#FBF7F2' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#8A7D70' }}>
            Produk sudah tidak tersedia
          </div>
          <div style={{ fontSize: 13, color: '#B7AA9A', marginTop: 4 }}>{item.slug}</div>
        </div>
        <button type="button" onClick={remove} style={removeButton}>
          Hapus
        </button>
      </div>
    );
  }

  const soldOut = status === 'soldout';

  return (
    <div style={card}>
      <div style={{ width: 72, flexShrink: 0 }}>
        <Img
          src={product.image}
          srcSet={product.image_srcset}
          sizes={SIZES.cartLine}
          alt={product.name}
          ratio="72/90"
          radius={12}
          style={soldOut ? { opacity: 0.55 } : undefined}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <Link to={`/produk/${product.slug}`} style={{ fontWeight: 700, fontSize: 15, color: '#43382E' }}>
          {product.name}
        </Link>
        <div style={{ fontSize: 13, color: '#8A7D70', marginTop: 2 }}>{product.category_label}</div>
        <div style={{ fontWeight: 700, color: '#D26E8E', marginTop: 6 }}>{fmt(product.price)}</div>

        {soldOut ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: '#C05C7E', marginTop: 8 }}>
            Stok habis
          </div>
        ) : status === 'overstock' ? (
          <div style={{ fontSize: 13, color: '#C08A2D', marginTop: 8 }}>
            Tersisa {available}.{' '}
            <button
              type="button"
              onClick={() => onQty(item.productId, available)}
              style={{ color: '#B4557A', fontWeight: 700 }}
            >
              Sesuaikan
            </button>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {!soldOut ? (
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
              aria-label="Kurangi jumlah"
              disabled={item.qty <= 1}
              onClick={() => onQty(item.productId, item.qty - 1)}
              style={qtyButton}
            >
              −
            </button>
            <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 700 }}>{item.qty}</span>
            <button
              type="button"
              className="hv-cream"
              aria-label="Tambah jumlah"
              disabled={item.qty >= Math.min(MAX_QTY, available)}
              onClick={() => onQty(item.productId, item.qty + 1)}
              style={qtyButton}
            >
              +
            </button>
          </div>
        ) : null}
        <button type="button" onClick={remove} style={removeButton}>
          Hapus
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5 }}>
      <span style={{ color: '#8A7D70' }}>{label}</span>
      <span style={{ fontWeight: muted ? 400 : 700, color: muted ? '#8A7D70' : '#43382E' }}>
        {value}
      </span>
    </div>
  );
}

const card = {
  display: 'flex',
  gap: 14,
  background: '#fff',
  border: '1px solid #F0E4CF',
  borderRadius: 16,
  padding: 14,
};

const qtyButton = { width: 34, height: 36, fontWeight: 700, fontSize: 16 };

const removeButton = { color: '#B7AA9A', fontSize: 13, fontWeight: 600, alignSelf: 'flex-end' };

const darkButton = {
  display: 'inline-block',
  background: '#43382E',
  color: '#FFFDF7',
  borderRadius: 999,
  padding: '13px 28px',
  fontWeight: 700,
  fontSize: 14.5,
};
