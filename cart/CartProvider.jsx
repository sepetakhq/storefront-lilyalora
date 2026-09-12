import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { readJson, writeJson } from '../lib/storage.js';
import { lineKey, migrateCart } from '../lib/variants.js';

const KEY = 'la3_cart';
// v3 adds `variantId` (null for a product sold as one thing). A v2 cart is
// carried forward rather than dropped: see migrateCart.
const VERSION = 3;
const MAX_QTY = 99; // the server's per-line cap

const CartContext = createContext(null);

/**
 * Both identifiers are stored, because they do different jobs and neither
 * substitutes for the other: `productId` (uuid) is what POST /checkout/draft
 * consumes, and `slug` is the only way to read a product back, since there is
 * no get-by-id endpoint. Storing one leaves the cart either unhydratable or
 * unsubmittable — and both come free from the product card at the moment of
 * adding.
 *
 * Name, price and image are deliberately NOT stored. They would go stale and
 * then contradict the draft, and the draft is the authoritative price.
 */
function load() {
  const items = migrateCart(readJson(localStorage, KEY, null));
  if (!items) return [];
  return items
    .filter((it) => it && typeof it.productId === 'string' && typeof it.slug === 'string')
    .map((it) => ({
      ...it,
      qty: clampQty(it.qty),
      variantId: typeof it.variantId === 'string' && it.variantId ? it.variantId : null,
    }));
}

function persist(items) {
  writeJson(localStorage, KEY, { v: VERSION, items });
}

function clampQty(n) {
  const q = Math.floor(Number(n) || 0);
  return Math.min(MAX_QTY, Math.max(1, q));
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);

  // Written through synchronously rather than in an effect: an effect loses
  // the last mutation when the buyer taps "Bayar" and the tab navigates.
  const commit = useCallback((next) => {
    persist(next);
    setItems(next);
    return next;
  }, []);

  // Lines are keyed by product and variant together (lineKey): two colours
  // of one product are two lines, the same colour twice is one.
  const add = useCallback(
    (product, qty = 1, variantId = null) => {
      const item = { productId: product.id, slug: product.slug, qty: clampQty(qty), variantId: variantId || null };
      const key = lineKey(item);
      const existing = items.find((it) => lineKey(it) === key);
      const next = existing
        ? items.map((it) => (lineKey(it) === key ? { ...it, qty: clampQty(it.qty + qty) } : it))
        : [...items, item];
      return commit(next);
    },
    [items, commit],
  );

  const setQty = useCallback(
    (key, qty) => commit(items.map((it) => (lineKey(it) === key ? { ...it, qty: clampQty(qty) } : it))),
    [items, commit],
  );

  const remove = useCallback(
    (key) => commit(items.filter((it) => lineKey(it) !== key)),
    [items, commit],
  );

  const clear = useCallback(() => commit([]), [commit]);

  const value = useMemo(
    () => ({
      items,
      add,
      setQty,
      remove,
      clear,
      count: items.reduce((n, it) => n + it.qty, 0),
      isEmpty: items.length === 0,
    }),
    [items, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

export { MAX_QTY };
