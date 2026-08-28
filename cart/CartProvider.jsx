import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { readJson, writeJson } from '../lib/storage.js';

const KEY = 'la3_cart';
const VERSION = 2;
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
  const stored = readJson(localStorage, KEY, null);
  if (!stored || stored.v !== VERSION || !Array.isArray(stored.items)) return [];
  return stored.items
    .filter((it) => it && typeof it.productId === 'string' && typeof it.slug === 'string')
    .map((it) => ({ ...it, qty: clampQty(it.qty) }));
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

  const add = useCallback(
    (product, qty = 1) => {
      const existing = items.find((it) => it.productId === product.id);
      const next = existing
        ? items.map((it) =>
            it.productId === product.id ? { ...it, qty: clampQty(it.qty + qty) } : it,
          )
        : [...items, { productId: product.id, slug: product.slug, qty: clampQty(qty) }];
      return commit(next);
    },
    [items, commit],
  );

  const setQty = useCallback(
    (productId, qty) =>
      commit(items.map((it) => (it.productId === productId ? { ...it, qty: clampQty(qty) } : it))),
    [items, commit],
  );

  const remove = useCallback(
    (productId) => commit(items.filter((it) => it.productId !== productId)),
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
