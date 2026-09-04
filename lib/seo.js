/**
 * The tab title, for client-side navigation only.
 *
 * The server writes the whole head of the document -- title, description,
 * Open Graph, canonical, JSON-LD -- in backend/internal/seo. That is the copy
 * that matters, because the consumers of those tags (WhatsApp, Facebook,
 * Google) never run this code.
 *
 * What the server cannot see is a route change inside the SPA. Navigating from
 * `/` to `/produk/voal` never re-fetches the document, so without this the tab
 * and the browser's history entry keep saying the home page's title. That is
 * the entire job here.
 *
 * Note what this file deliberately does NOT do: it never touches og:*,
 * canonical or JSON-LD. Rewriting them client-side would help nobody -- no
 * crawler that reads them executes JavaScript -- while creating a second place
 * for the rules to drift out of step with the Go.
 *
 * The title rule itself is mirrored from backend/internal/seo/meta.go (Title).
 * Keep the two in step; the shape is small on purpose so that staying in step
 * is cheap.
 */

/** Matches seo.MaxTitleRunes in backend/internal/seo/meta.go. */
export const MAX_TITLE = 60;

/**
 * "<page> — <brand>", or just the brand when there is no page part.
 *
 * Truncation eats the page name rather than the brand: the brand is the half a
 * reader uses to recognise which tab is which.
 */
export function pageTitle(page, brand) {
  const p = collapse(page);
  const b = collapse(brand);

  if (!p && !b) return '';
  if (!p) return truncate(b, MAX_TITLE);
  if (!b || p.toLowerCase() === b.toLowerCase()) return truncate(p, MAX_TITLE);

  const room = MAX_TITLE - [...b].length - 3; // " — "
  // The brand alone already fills the budget. A title that is nothing but a
  // chopped brand says less than an honest over-long one.
  if (room < 12) return `${p} — ${b}`;
  return `${truncate(p, room)} — ${b}`;
}

/**
 * The page half of the title for a route, or '' when its data has not loaded.
 *
 * Returning '' matters: the server already put the correct title in the
 * document, so writing a placeholder while a query is still pending would
 * visibly flash the right title to a wrong one and back.
 */
export function pageName(pathname, { product, taglineShort } = {}) {
  // The home page is titled by the short tagline, matching builder.home() in
  // backend/internal/httpapi/seo.go. Without this the client would overwrite
  // the server's descriptive title with the bare brand the moment React
  // mounted -- a visible flicker, and two answers to one question.
  if (pathname === '/' || pathname === '') return truncate(collapse(taglineShort), 40);
  if (pathname.startsWith('/katalog')) return 'Katalog';
  if (pathname.startsWith('/tentang')) return 'Tentang';
  if (pathname.startsWith('/keranjang')) return 'Keranjang';
  if (pathname.startsWith('/checkout')) return 'Checkout';
  if (pathname.startsWith('/lacak')) return 'Lacak pesanan';
  if (pathname.startsWith('/produk/')) return product?.name ?? '';
  // An order page is titled by its number and never by the buyer's name or
  // city, both of which are on the screen but neither of which belongs in a
  // browser history entry.
  if (pathname.startsWith('/pesanan/') || pathname.startsWith('/track/')) return 'Pesanan';
  return '';
}

/** Cuts to at most `max` characters, on a word boundary, with an ellipsis. */
function truncate(s, max) {
  const chars = [...s]; // by code point: brand copy carries emoji
  if (max <= 0 || chars.length <= max) return s;

  const cut = chars.slice(0, max - 1).join('');
  const lastSpace = cut.lastIndexOf(' ');
  const body = lastSpace > cut.length / 2 ? cut.slice(0, lastSpace) : cut;
  return `${body.replace(/ +$/, '')}…`;
}

function collapse(s) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
