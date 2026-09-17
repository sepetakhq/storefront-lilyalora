import { useSearchParams } from 'react-router-dom';

import ProductCard from '../components/ProductCard.jsx';
import { EmptyState, ErrorState, InlineError, ProductGridSkeleton } from '../ui/states.jsx';
import { useCategories, useProducts } from '@sepetakhq/storefront-kit/hooks/queries';

const ALL = 'Semua';

const SORTS = [
  ['featured', 'Unggulan'],
  ['priceAsc', 'Harga terendah'],
  ['priceDesc', 'Harga tertinggi'],
  ['nameAsc', 'Nama A–Z'],
];

// Columns live in styles.css so the breakpoint can match the cards' `sizes`.

export default function CatalogRoute() {
  // Filters live in the URL, not in state: a filtered catalogue is a link
  // worth sharing, and the back button should unwind a filter change.
  const [params, setParams] = useSearchParams();
  const cat = params.get('cat') || ALL;
  const sort = params.get('sort') || 'featured';

  const categories = useCategories();
  const products = useProducts({ cat, sort });

  const setParam = (key, value, { replace = false } = {}) => {
    const next = new URLSearchParams(params);
    if (!value || value === ALL || value === 'featured') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace });
  };

  const pages = products.data?.pages ?? [];
  const items = pages.flatMap((p) => p.products);

  return (
    <main
      aria-label="Katalog"
      style={{ flex: 1, maxWidth: 1200, margin: '0 auto', padding: '36px 20px 60px', width: '100%' }}
    >
      <h1
        style={{
          fontFamily: "'Cormorant Garamond',serif",
          fontSize: 44,
          fontWeight: 600,
          margin: '0 0 6px',
        }}
      >
        Katalog
      </h1>
      <p style={{ color: '#8A7D70', margin: '0 0 24px' }}>
        {/* The API sends no total, so this counts what has actually loaded and
            says so rather than implying it is the whole catalogue. */}
        {products.isPending
          ? 'Memuat produk…'
          : `Menampilkan ${items.length} produk · dikirim dari Pekalongan`}
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24 }}>
        <Pill label="Semua" active={cat === ALL} onClick={() => setParam('cat', ALL)} />
        {(categories.data ?? []).map((c) => (
          <Pill
            key={c.key}
            label={c.label}
            active={cat === c.key}
            onClick={() => setParam('cat', c.key)}
          />
        ))}

        <select
          value={sort}
          aria-label="Urutkan"
          // A sort tweak is not a navigation — it should not add a history entry.
          onChange={(e) => setParam('sort', e.target.value, { replace: true })}
          style={{
            marginLeft: 'auto',
            border: '1px solid #F0E4CF',
            borderRadius: 999,
            padding: '9px 16px',
            fontWeight: 600,
            fontSize: 14,
            background: '#fff',
          }}
        >
          {SORTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {categories.isError ? (
        <div style={{ marginBottom: 18 }}>
          <InlineError error={categories.error} onRetry={categories.refetch} />
        </div>
      ) : null}

      {products.isPending ? (
        <ProductGridSkeleton count={8} />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={products.refetch} title="Katalog gagal dimuat" />
      ) : items.length === 0 ? (
        <EmptyState
          title="Belum ada produk di sini"
          body={
            cat === ALL
              ? 'Katalognya sedang disiapkan. Coba lagi sebentar lagi.'
              : 'Kategori ini masih kosong. Lihat koleksi lainnya.'
          }
          action={
            cat === ALL ? null : (
              <button type="button" onClick={() => setParam('cat', ALL)} style={ghostButton}>
                Lihat semua produk
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="product-grid">
            {items.map((p, i) => (
              <ProductCard key={p.id} p={p} variant="grid" showSoldOut priority={i < 4} />
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 34 }}>
            {products.hasNextPage ? (
              <button
                type="button"
                className="hv-dark"
                disabled={products.isFetchingNextPage}
                onClick={() => products.fetchNextPage()}
                style={{
                  background: '#43382E',
                  color: '#FFFDF7',
                  borderRadius: 999,
                  padding: '13px 30px',
                  fontWeight: 700,
                  fontSize: 14.5,
                  opacity: products.isFetchingNextPage ? 0.6 : 1,
                }}
              >
                {products.isFetchingNextPage ? 'Memuat…' : 'Muat lagi'}
              </button>
            ) : (
              <span style={{ color: '#B7AA9A', fontSize: 13 }}>Itu semua koleksinya.</span>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function Pill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        borderRadius: 999,
        padding: '9px 20px',
        fontWeight: 700,
        fontSize: 14,
        background: active ? '#D26E8E' : '#fff',
        color: active ? '#fff' : '#43382E',
        border: `1px solid ${active ? '#D26E8E' : '#F0E4CF'}`,
      }}
    >
      {label}
    </button>
  );
}

const ghostButton = {
  border: '1px solid #F0E4CF',
  background: '#fff',
  borderRadius: 999,
  padding: '11px 24px',
  fontWeight: 600,
  fontSize: 14,
};
