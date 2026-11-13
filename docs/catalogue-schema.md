# Catalogue schema (Supabase)

Status (verified 10 November 2026): applied to the Supabase project
`make-my-perfume` (ref `vqhomfpmybbhqskspegl`, shown as production by the CLI).
The preflight found an empty public schema. Four migrations are applied and
recorded in `supabase_migrations.schema_migrations`. The storefront reads this
database (see "Storefront integration" below).

Decisions (owner, 2026-11-10): migrations are applied with the Supabase CLI
(`supabase` is a dev dependency); the six demo products become `draft` in the
database but the storefront keeps showing the local six until something real is
published; workbook rows are staged as drafts with no public name.

## Files

| File | Purpose |
|---|---|
| `supabase/preflight.sql` | Read-only. Run first in the SQL editor; lists existing tables, RLS and policies. |
| `supabase/migrations/20261110061340_catalogue_schema.sql` | Tables, constraints, triggers. Aborts untouched if any catalogue table already exists. |
| `supabase/migrations/20261110061345_catalogue_rls_and_views.sql` | RLS, column grants, read policies, three views. |
| `supabase/migrations/20261110061349_catalogue_seed_taxonomy.sql` | 7 categories, 6 scent families. No products, prices, images or stock. |
| `supabase/migrations/20261110071341_catalogue_import_row_indexes.sql` | Two foreign-key indexes the performance advisor flagged. |
| `supabase/staging/workbook-2026-11-10.sql` | Generated. Stages the workbook as drafts. Idempotent, one transaction. |
| `supabase/staging/demo-products.sql` | Generated. Stores the six concept products as drafts. |
| `scripts/stage-catalogue.py` | Reads the workbook (standard library only) and generates the two staging files and `docs/catalogue-import-report.md`. |
| `supabase/rollbacks/20261110_catalogue_down.sql` | Manual rollback (not run by the CLI). |
| `supabase/tests/catalogue.test.mjs` | 72 checks on a local Postgres engine. |
| `supabase/tests/staging.test.mjs` | 17 checks on the staging SQL: counts, idempotency, all-or-nothing, nothing public. |

## Model

- `products`: one row per fragrance. `title` and `slug` stay empty until a
  human reviews the public name. `source_title` / `source_url` keep the original
  listing and are never public. Status: draft, in_review, published, archived.
  Publishing needs title, slug, approval time, publish time and at least one
  active variant.
- `product_variants`: one row per bottle size with its own SKU and price
  (> 0). A compare-at price can only be stored once approved, so an unverified
  "was" price cannot exist.
- `categories`: `all`, `audience` (men / women / unisex), `type` (inspired /
  bundle) and `landing` (a page such as `/make`). Membership is only in
  `product_categories`.
- `scent_families` + `product_scent_families`: filters, many per product. A row
  exists only once the notes are verified.
- `product_images`: only `verified` images are public; none are by default.
- `inventory`: availability defaults to `unknown`, quantity empty. No invented stock.
- `product_import_batches` / `product_import_rows`: source file hash, sheet and
  row, original and normalized values, validation errors, review status.
  Unique per source row, so a re-import cannot duplicate.

## Security

- RLS is on for all ten tables. The public (anon and signed-in users) can only
  read: published, approved products; active variants of those; their category
  and family links; verified images; availability.
- Nobody can write through the API: no insert/update/delete grants or policies.
  Management uses the service role (never in the browser) or the SQL editor.
- Column grants hide `source_title`, `source_url`, `product_key`, stock
  quantity and timestamps. Import tables have no grants. Because of column
  grants, browser queries must list columns; `select *` is refused.
- Views use `security_invoker`, so they can never widen access.

## Views

- `v_public_categories`: landing pages plus categories with published products (navigation).
- `v_storefront_products`: published products with an active variant, `from_price_inr`, `sizes_ml`. Latest Arrivals = order by `published_at desc`.
- `v_active_sales`: approved compare-at above the selling price, inside the
  sale window; `discount_pct` computed from those values.

## Storefront integration

- `src/data/repository.ts` is the single reader. It asks Supabase for published
  products and falls back to the bundled concept catalogue (`src/data/legacy`)
  when Supabase is unreachable, slow (4 s), or has nothing published. Once one
  real product is published the concept catalogue stops showing.
  `VITE_CATALOGUE_SOURCE=local` forces the fallback (unit tests use it).
- `src/data/catalogue.ts` names every column it reads (the public has
  column-level grants). Sales come from `v_active_sales`, so the discount shown
  is the one the database computed.
- Navigation categories come from `v_public_categories`; without published
  products only Shop All Perfumes and Create Your Perfume (`/make`) show.
- Latest Arrivals and On Sale (`src/components/ProductCarousel.tsx`) render
  nothing when nothing is eligible. Latest Arrivals never includes a product
  without a publication time.
- Production: `/api/config` is served by the Vite dev and preview servers. For
  a deployed site `api/config.js` does the same on Vercel, reading
  `SUPABASE_PROJECT_URL` and `SUPABASE_ANON_KEY` from the host environment.
  It is not deployed.

## Publishing a product (owner steps)

A product becomes visible only when ALL of these are set, by the owner or a
trusted service (not the browser): `title`, `slug`, `approved_at`,
`published_at` (not in the future), `status = 'published'`, and at least one
variant with `is_active = true`. Audience, Inspired/bundle and scent families
come from `product_categories` and `product_scent_families`. A verified image
needs a `product_images` row with `verification_status = 'verified'`. A sale
needs `compare_at_inr` above the price, `compare_at_approved_at`, and an
optional window. Review `docs/catalogue-import-report.md` first.

## Applying schema changes (owner steps)

1. Run `supabase/preflight.sql`; send me the result.
2. `npx supabase login`, then `npx supabase link --project-ref <ref>`.
3. `npx supabase db push --dry-run --remote` and check the listed files, then
   `npx supabase db push --remote`.
4. Run the Supabase security and performance advisors in the dashboard and send me the findings.
