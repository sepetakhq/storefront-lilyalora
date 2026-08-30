// Query keys in one place, so an invalidation can never miss a cache entry by
// spelling a key differently from the hook that filled it.

/**
 * Product-list params are normalised before entering a key: undefined values
 * dropped and key order fixed. Two cosmetically different but equal filters
 * must produce the same key or the cache thrashes on every render.
 */
function normalizeProductParams(params = {}) {
  const { cat, tag, sort, limit } = params;
  const out = {};
  if (cat && cat !== 'Semua') out.cat = cat;
  if (tag) out.tag = tag;
  if (sort && sort !== 'featured') out.sort = sort;
  if (limit) out.limit = limit;
  return out;
}

export const qk = {
  config: ['config'],
  home: ['home'],
  page: (key) => ['page', key],
  categories: ['categories'],
  products: (params) => ['products', normalizeProductParams(params)],
  product: (slug) => ['product', slug],
  track: (token) => ['track', token],
  destinations: (q) => ['shipping', 'destinations', q],
  // Keyed on the destination and the cart together: both change the answer,
  // and a stale rate list is a price the buyer would be shown and then
  // refused at the draft step.
  rates: (destinationRef, cartKey) => ['shipping', 'rates', destinationRef, cartKey],
};

export { normalizeProductParams };
