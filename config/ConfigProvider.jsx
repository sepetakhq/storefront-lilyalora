import { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getConfig } from '../api/endpoints.js';
import { qk } from '../api/queryKeys.js';
import { fmt, shippingCopy } from '../shared/format.js';

const ConfigContext = createContext(null);

// Brand copy, nav, couriers and payment methods all come from the tenant. The
// whole shell depends on them, so the app waits for this one request rather
// than rendering a header with placeholder text and then swapping it.
export function ConfigProvider({ children, fallback, errorFallback }) {
  const query = useQuery({
    queryKey: qk.config,
    queryFn: ({ signal }) => getConfig(signal),
    // Brand identity does not change mid-visit.
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const value = useMemo(() => (query.data ? shape(query.data) : null), [query.data]);

  if (query.isPending) return fallback ?? null;
  if (query.isError || !value) return errorFallback?.(query.error, query.refetch) ?? null;

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used inside ConfigProvider');
  return ctx;
}

// The API's nav entries name the prototype's screens, not URLs.
const ROUTE_PATHS = {
  home: '/',
  catalog: '/katalog',
  track: '/lacak',
  about: '/tentang',
};

function shape(raw) {
  const commerce = raw.commerce ?? {};
  const brand = raw.brand ?? {};
  const freeShippingMin = commerce.free_shipping_min ?? 0;
  // The offer, not the threshold. No threshold can say "never" -- zero already
  // means "always" -- so the flag is separate, and it is negative in the
  // payload so that a config written before it existed still ships free.
  const freeShipping = !commerce.free_shipping_disabled;

  // Every slice on brand comes from JSONB and arrives as null, not [], when
  // the tenant has not set it.
  const nav = (brand.nav ?? [])
    .map((n) => ({ ...n, path: ROUTE_PATHS[n.route] }))
    .filter((n) => n.path);

  // Brand copy ships with literal {free_shipping_min} placeholders. With the
  // offer switched off, copy that names one is withheld instead: it promises a
  // discount the checkout would not give.
  const values = { free_shipping_min: fmt(freeShippingMin) };
  const copy = (s) => shippingCopy(s, values, freeShipping);

  return {
    tenant: raw.tenant ?? {},
    contactChannel: raw.contact?.channel || 'email',
    payment: raw.payment ?? {},
    freeShipping,
    freeShippingMin,
    freeShippingMinLabel: values.free_shipping_min,
    couriers: commerce.couriers ?? [],
    paymentMethods: commerce.payment_methods ?? [],
    // Which checkout to render: a courier list that already carries its
    // prices, or a destination search followed by a live rate lookup. The
    // server reports flat for a tenant whose live configuration is incomplete,
    // so this is safe to branch on directly.
    liveShipping: commerce.shipping?.mode === 'live',
    brand: {
      ...brand,
      nav,
      // A stat whose label was withheld is dropped rather than rendered as a
      // bare "Gratis" with nothing under it.
      heroStats: (brand.hero_stats ?? [])
        .map((s) => ({ ...s, label: copy(s.label) }))
        .filter((s) => s.label),
      heroImages: brand.hero_images ?? [],
      sections: brand.section_copy ?? {},
      tagline: copy(brand.tagline),
      productCareCopy: copy(brand.product_care_copy),
      productShippingCopy: copy(brand.product_shipping_copy),
    },
    copy,
  };
}
