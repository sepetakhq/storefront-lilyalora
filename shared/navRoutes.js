/**
 * The screens a storefront nav entry can point at.
 *
 * A nav entry's `route` is a key, not a path. The storefront maps the key
 * to a URL and drops any entry it does not recognise, so the backoffice
 * offers exactly this list and flags anything else -- one list, read by
 * both, or the two drift and a merchant saves a nav item that silently never
 * appears. The API keeps its own copy of the keys (admin_settings.go
 * navRoutes) as the authority on what it will store.
 *
 * `label` is the default wording a new shop gets; the merchant renames it.
 */
export const NAV_ROUTES = [
  { value: 'home', label: 'Beranda', path: '/' },
  { value: 'catalog', label: 'Katalog', path: '/katalog' },
  { value: 'track', label: 'Lacak Pesanan', path: '/lacak' },
  { value: 'about', label: 'Tentang', path: '/tentang' },
];

/** `{ home: '/', catalog: '/katalog', ... }` */
export const ROUTE_PATHS = Object.fromEntries(NAV_ROUTES.map((r) => [r.value, r.path]));
