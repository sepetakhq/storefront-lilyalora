import { useMemo } from 'react';

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

      let status = 'ok';
      if (q?.isPending) status = 'loading';
      // A 404 means unpublished or deleted — the product is gone, not broken.
      else if (q?.error?.status === 404) status = 'gone';
      else if (q?.isError) status = 'error';
      else if (product?.sold_out || product?.stock <= 0) status = 'soldout';
      else if (item.qty > product?.stock) status = 'overstock';

      return {
        item,
        product: product ?? null,
        status,
        error: q?.error ?? null,
        refetch: q?.refetch,
        available: product?.stock ?? 0,
        lineTotal: product ? product.price * item.qty : 0,
      };
    });

    const priced = lines.filter((l) => l.status === 'ok' || l.status === 'overstock');
    return {
      lines,
      subtotal: priced.reduce((sum, l) => sum + l.lineTotal, 0),
      isLoading: lines.some((l) => l.status === 'loading'),
      // Anything that would make the draft fail outright.
      hasBlockers: lines.some((l) => l.status === 'gone' || l.status === 'soldout'),
      hasErrors: lines.some((l) => l.status === 'error'),
    };
  }, [items, results]);
}
