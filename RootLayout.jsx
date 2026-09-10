import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';

import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Toast from './components/Toast.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import { ConfigProvider } from './config/ConfigProvider.jsx';
import { CartProvider } from './cart/CartProvider.jsx';
import { ToastProvider } from './ui/ToastProvider.jsx';
import { useHome, useProduct } from './hooks/queries.js';
import { useConfig } from './config/ConfigProvider.jsx';
import { useDocumentTitle } from './hooks/useDocumentTitle.js';
import { pageName, pageTitle } from './lib/seo.js';
import { ErrorState } from './ui/states.jsx';

const MOBILE_MAX = 820;

export default function RootLayout() {
  return (
    <ConfigProvider fallback={<Splash />} errorFallback={(error, retry) => <StoreUnavailable error={error} onRetry={retry} />}>
      <CartProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </CartProvider>
    </ConfigProvider>
  );
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();

  // Close the drawer on navigation; leaving it open over a new screen is the
  // classic mobile-nav bug.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ScrollRestoration />
      <DocumentTitle />
      <UpdateBanner />
      <Announcement />
      <Header
        isMobile={isMobile}
        menuOpen={menuOpen && isMobile}
        onToggleMenu={() => setMenuOpen((o) => !o)}
        onNavigate={() => setMenuOpen(false)}
      />
      <Outlet />
      <Footer />
      <Toast />
    </div>
  );
}

/**
 * The promo strip. It comes from the same payload as the home sections, so it
 * is simply absent until that query resolves rather than flashing in.
 *
 * Exported for its test: the layout around it needs a router and a query
 * client, and the rules about when this bar renders are worth testing without
 * either.
 */
export function Announcement() {
  const { data } = useHome();
  const { copy } = useConfig();
  const announcement = data?.announcement;
  if (!announcement?.enabled) return null;

  // Through the same substitution as the tagline and the product copy, so a
  // banner written as "gratis ongkir min {free_shipping_min}" follows the
  // threshold the merchant actually set instead of a number typed once and
  // forgotten. And when the offer is switched off the sentence is withheld
  // rather than interpolated -- a bar promising free shipping the checkout
  // would refuse is worse than no bar, which is why an empty result renders
  // nothing at all.
  const text = copy(announcement.text);
  if (!text) return null;

  return (
    <Link
      to="/katalog"
      style={{
        background: 'linear-gradient(90deg,#F3B8C8,#F5E6AE)',
        color: '#6E4634',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        display: 'block',
        width: '100%',
        padding: '8px 16px',
        textAlign: 'center',
      }}
    >
      {text}
    </Link>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_MAX);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_MAX);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

/**
 * Keeps the tab title in step as the buyer moves around.
 *
 * Renders nothing. The server already wrote the head of the document this page
 * arrived as, including its title; an SPA navigation never re-fetches that, so
 * the tab would otherwise be stuck on whichever page was loaded first.
 *
 * The product name comes from useProduct, which shares a cache entry with
 * ProductRoute's own call -- same query key, so this costs no extra request. It
 * resolves after the route renders, and until it does pageName returns '' and
 * the hook leaves the server's title alone.
 */
function DocumentTitle() {
  const { pathname } = useLocation();
  const { brand, tenant } = useConfig();

  const slug = pathname.startsWith('/produk/') ? pathname.slice('/produk/'.length) : '';
  const { data: product } = useProduct(slug);

  const brandName =
    [brand?.wordmark_primary, brand?.wordmark_accent].filter(Boolean).join(' ') || tenant?.name || '';

  useDocumentTitle(
    pageTitle(pageName(pathname, { product, taglineShort: brand?.tagline_short }), brandName),
  );
  return null;
}

/**
 * Shown while the tenant's brand identity loads — the whole shell depends on it.
 *
 * Deliberately wordless. This is ConfigProvider's own fallback, so it renders
 * outside the context it is waiting for and cannot know whose shop this is;
 * anything it named would be one particular merchant's, shown to all of them.
 */
function Splash() {
  return <div style={{ minHeight: '100vh', background: '#FFFDF7' }} />;
}

/**
 * The shell could not load: an unknown host (404), a suspended store (503), or
 * a bundle pinned to an API version the server no longer serves. All three are
 * real, and none should render as a broken page.
 */
function StoreUnavailable({ error, onRetry }) {
  const suspended = error?.status === 503;
  // This tab is running a cached bundle older than anything the API still
  // speaks. Retrying re-sends the same dead version forever; only a reload
  // fetches a newer bundle. index.html is served no-cache, so it will.
  const stale = error?.code === 'unsupported_api_version';

  let title = 'Toko tidak ditemukan';
  if (stale) title = 'Aplikasi perlu dimuat ulang';
  else if (suspended) title = 'Toko sedang tidak aktif';

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#FFFDF7' }}>
      <ErrorState
        error={error}
        title={title}
        onRetry={stale ? () => window.location.reload() : suspended ? onRetry : undefined}
      />
    </div>
  );
}

export { useIsMobile };
