import { describe, expect, it } from 'vitest';

import { NAV_ROUTES, ROUTE_PATHS } from './navRoutes.js';

describe('navRoutes', () => {
  it('names the four screens the storefront routes and the API accepts', () => {
    expect(NAV_ROUTES.map((r) => r.value)).toEqual(['home', 'catalog', 'track', 'about']);
    expect(ROUTE_PATHS).toEqual({ home: '/', catalog: '/katalog', track: '/lacak', about: '/tentang' });
  });

  it('gives every route a label a new shop can ship with', () => {
    for (const r of NAV_ROUTES) expect(r.label.length).toBeGreaterThan(0);
  });
});
