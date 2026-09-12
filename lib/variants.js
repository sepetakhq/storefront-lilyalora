/**
 * Everything the storefront decides about a product sold in variants.
 *
 * Decisions only, no sentences: the Indonesian copy lives in the screens and
 * the English twin in templates/balilinen/src/lib/copy.js, both importing
 * from here so the two storefronts cannot disagree about which combination
 * is buyable.
 *
 * Shapes, as the API sends them:
 *   product.options  = [{ name, values: [] }]          axes, in display order
 *   product.variants = [{ id, options: {axis: value}, price, stock, sold_out,
 *                         compare_at_price, on_sale, badge, sku, weight_grams, image_id }]
 *   product.has_variants, product.price (the cheapest), product.price_max
 */

/** The key a cart line is stored and matched under: product, then variant. */
export function lineKey(item) {
  return `${item?.productId ?? item?.product_id ?? ''}:${item?.variantId ?? item?.variant_id ?? ''}`;
}

export function resolveVariant(product, variantId) {
  if (!variantId) return null;
  return product?.variants?.find((v) => v.id === variantId) ?? null;
}

/**
 * The product as it should be judged for one variant: price, stock and
 * sold_out are the variant's, so every helper that reads a product --
 * stockNote, maxQty, availableQty, isSoldOut, cartLineStatus -- works
 * unchanged on the result. Without a variant the product is returned as-is.
 */
export function withVariant(product, variant) {
  if (!product || !variant) return product;
  return {
    ...product,
    price: variant.price,
    compare_at_price: variant.compare_at_price,
    on_sale: variant.on_sale,
    badge: variant.badge,
    stock: variant.stock,
    sold_out: variant.sold_out,
    variant,
  };
}

/** True once every axis has a value picked. */
export function isComplete(options, selected) {
  return (options ?? []).every((o) => Boolean(selected?.[o.name]));
}

/** The one variant matching a complete selection, or null. */
export function matchVariant(variants, selected) {
  if (!variants?.length || !selected) return null;
  const keys = Object.keys(selected).filter((k) => selected[k]);
  return (
    variants.find(
      (v) =>
        Object.keys(v.options ?? {}).length === keys.length &&
        keys.every((k) => v.options?.[k] === selected[k]),
    ) ?? null
  );
}

/**
 * For one axis, given what is picked on the OTHER axes: each value with
 * whether any variant carries it (exists) and whether every such variant is
 * sold out. A value with no variant is a combination the shop does not sell;
 * the picker greys both out and the server never sees either.
 */
export function availableValues(product, axisName, selected) {
  const axis = (product?.options ?? []).find((o) => o.name === axisName);
  if (!axis) return [];
  const others = Object.entries(selected ?? {}).filter(([k, v]) => k !== axisName && v);
  return axis.values.map((value) => {
    const candidates = (product.variants ?? []).filter(
      (v) => v.options?.[axisName] === value && others.every(([k, val]) => v.options?.[k] === val),
    );
    return {
      value,
      exists: candidates.length > 0,
      soldOut: candidates.length > 0 && candidates.every((v) => v.sold_out),
    };
  });
}

/**
 * The selection to start from: any axis with a single value is picked, and a
 * product with exactly one variant is picked outright. Nothing else is
 * guessed -- a default colour would sell the wrong colour to someone in a
 * hurry.
 */
export function initialSelection(product) {
  const sel = {};
  if (!product?.has_variants) return sel;
  if (product.variants?.length === 1) return { ...product.variants[0].options };
  for (const o of product.options ?? []) {
    if (o.values.length === 1) sel[o.name] = o.values[0];
  }
  return sel;
}

/**
 * Pick a value, dropping picks on other axes that no longer combine with it,
 * so the buyer is never left with a selection that names nothing.
 */
export function select(product, selected, axisName, value) {
  const next = { ...selected, [axisName]: value };
  for (const o of product?.options ?? []) {
    if (o.name === axisName || !next[o.name]) continue;
    const still = availableValues(product, o.name, next).find((x) => x.value === next[o.name]);
    if (!still?.exists) delete next[o.name];
  }
  return next;
}

/** "70×140 cm / Putih", values in axis order. */
export function variantLabel(product, variant) {
  if (!variant) return '';
  const inOrder = (product?.options ?? []).map((o) => variant.options?.[o.name]).filter(Boolean);
  if (inOrder.length) return inOrder.join(' / ');
  return Object.values(variant.options ?? {}).join(' / ');
}

/** Is there a "from" price to speak of? */
export function isPriceRange(product) {
  return Boolean(product?.has_variants) && Number(product.price_max) > Number(product.price);
}

/**
 * The gallery with the variant's own photo first, when it has one that is
 * still in the gallery; otherwise the gallery as-is.
 */
export function galleryFor(images, variant) {
  const list = images ?? [];
  if (!variant?.image_id) return list;
  const idx = list.findIndex((im) => im.id === variant.image_id);
  if (idx <= 0) return list;
  return [list[idx], ...list.slice(0, idx), ...list.slice(idx + 1)];
}

/** A cart item that predates the product's variants, or never chose one. */
export function needsVariant(item, product) {
  return Boolean(product?.has_variants) && !item?.variantId;
}

/**
 * Cart storage across versions. v2 items had no variant; they are kept with
 * `variantId: null`, which the cart then flags as needing a choice for any
 * product that has since grown variants. Anything else is dropped, as before.
 */
export function migrateCart(stored) {
  if (!stored || !Array.isArray(stored.items)) return null;
  if (stored.v === 3) return stored.items;
  if (stored.v === 2) return stored.items.map((it) => ({ ...it, variantId: null }));
  return null;
}
