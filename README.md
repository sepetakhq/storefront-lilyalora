# storefront-lilyalora

Lily Alora's storefront: the screens, components and styles. Everything
that is not a design — API client, tenant config, cart, checkout state,
the helpers that decide what a page may say — comes from
[`@sepetakhq/storefront-kit`](https://www.npmjs.com/package/@sepetakhq/storefront-kit).

## Develop

Run the platform API first (`make up && make seed && make api` in the
`platform` checkout), then:

```
npm install
npm run dev          # http://localhost:5173, /api proxied to the API on :8090
```

`API_TARGET` and `DEV_PORT` override the proxy target and port. The document
head is filled from the API by the kit's `seoDevPlugin`, so what you see is
what the binary would serve.

## Ship

`public/manifest.json` (title, description in `id` and `en`, preview file
name) and `public/preview.jpg` are this template's catalogue entry: the
backoffice picker and the landing read them from the registry beside
`index.html`. `src/manifest.test.js` refuses a push without them.

Every push to `main` builds and uploads to the template registry
(`.github/workflows/release.yml`); the API serves the new build within a
minute. To see the registry path locally, publish to the dev MinIO and open
the API's own host:

```
npm run publish:local
open http://localhost:8090/
```

## Rules

- Serve exactly the kit's `ROUTE_CONTRACT` (`src/routes.test.js` pins it).
- Keep the `<!--seo:start-->` / `<!--seo:end-->` markers in `index.html`.
- Copy and colours are this repo's; decisions (sale windows, stock, payment
  kinds) are the kit's. Branch on `payment.kind`, render `order.timeline`.
