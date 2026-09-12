import { useMemo } from 'react';

import { availableQty, cartLineStatus, leadDays } from '../lib/preorder.js';
import { isBlocking } from '../lib/availability.js';
import { lineKey, needsVariant, resolveVariant, variantLabel, withVariant } from '../lib/variants.js';
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

      // A product sold in variants is judged as the variant the line names:
      // withVariant overlays its price and stock, so every rung below reads
      // the right number. Two rungs come first: an item that never chose a
      // variant on a product that has them, and a variant that is gone.
      const variant = resolveVariant(product, item.variantId);
      const sellable = withVariant(product, variant);
      let status;
      if (product && needsVariant(item, product)) status = 'variant_required';
      else if (product && item.variantId && !variant) status = 'gone';
      // Both stock rungs of this ladder are skipped for a made-to-order
      // product; see src/lib/preorder.js, where the rule is tested.
      else status = cartLineStatus(item, sellable, q);

      return {
        item,
        key: lineKey(item),
        product: sellable ?? null,
        variant,
        label: variantLabel(product, variant),
        status,
        error: q?.error ?? null,
        refetch: q?.refetch,
        available: availableQty(sellable),
        preorder: Boolean(product?.preorder),
        leadDays: leadDays(product),
        lineTotal: sellable ? sellable.price * item.qty : 0,
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
      // Every status the draft would refuse, named once in availability.js so
      // a rung added to the ladder cannot be forgotten here.
      hasBlockers: lines.some((l) => isBlocking(l.status)),
      statuses: lines.map((l) => l.status),
      hasErrors: lines.some((l) => l.status === 'error'),
    };
  }, [items, results]);
}
