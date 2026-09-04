import { useMemo } from 'react';

import { availableQty, cartLineStatus, leadDays } from '../lib/preorder.js';
import { useProductsBySlug } from '../hooks/queries.js';
import { useCart } from './CartProvider.jsx';

/**
 * Joins the stored cart against live product data.
 *
 * The subtotal here is ADVISORY. It is arithmetic over catalogue prices that
 * may be minutes old, and the server re-prices the whole cart at draft time
 * without reporting that it did. The authoritative number appears exactly
 * once, in the draft response.
 */
export function useCartLines() {
  const { items } = useCart();
  const slugs = useMemo(() => items.map((it) => it.slug), [items]);
  const results = useProductsBySlug(slugs);

  return useMemo(() => {
    const lines = items.map((item, i) => {
      const q = results[i];
      const product = q?.data;

      // Both stock rungs of this ladder are skipped for a made-to-order
      // product; see src/lib/preorder.js, where the rule is tested.
      const status = cartLineStatus(item, product, q);

      return {
        item,
        product: product ?? null,
        status,
        error: q?.error ?? null,
        refetch: q?.refetch,
        available: availableQty(product),
        preorder: Boolean(product?.preorder),
        leadDays: leadDays(product),
        lineTotal: product ? product.price * item.qty : 0,
      };
    });

    const priced = lines.filter((l) => l.status === 'ok' || l.status === 'overstock');
    return {
      lines,
      subtotal: priced.reduce((sum, l) => sum + l.lineTotal, 0),
      // The whole cart waits for its slowest pre-order line, because it ships
      // once. Advisory like the subtotal above it: the draft is authoritative.
      preorderLeadDays: lines.reduce((max, l) => (l.preorder && l.leadDays > max ? l.leadDays : max), 0),
      isLoading: lines.some((l) => l.status === 'loading'),
      // Anything that would make the draft fail outright.
      hasBlockers: lines.some((l) => l.status === 'gone' || l.status === 'soldout'),
      hasErrors: lines.some((l) => l.status === 'error'),
    };
  }, [items, results]);
}
