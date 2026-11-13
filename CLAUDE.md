# MAKE MY PERFUME — CLAUDE.md
## Development Governance & Project Rules
Version: 2.0
Updated: 10 November 2026

# 1. PROJECT IDENTITY

Make My Perfume is an existing premium fragrance-commerce frontend prototype undergoing controlled, phased development into a database-backed e-commerce application.

The application currently uses the Scroll-Craft design methodology and an established React component architecture.

The immediate development scope is:

- Supabase catalogue schema and security.
- Safe product migration from the verified partial legacy-site extraction.
- Corrected product category architecture.
- Existing fragrance-family filtering.
- Latest Arrivals homepage carousel.
- On Sale homepage carousel.

The existing application is NOT yet a fully operational e-commerce platform.

Unless separately approved, authentication, live payments, order processing, shipping, tax automation, email notifications, administrative tooling, and production deployment remain out of scope.

The original project brief remains mandatory reference material:

`scrollcraft/builds/make-my-perfume/BRIEF.md`

Read it before making changes.

Where older documentation conflicts with newer, explicitly approved owner decisions, the newer approved decision takes precedence only for the specific conflicting requirement.

All other existing requirements remain valid.

# 2. PRIMARY ENGINEERING DIRECTIVE

Make minimal, targeted changes to the existing application.

DO NOT redesign or rebuild the website.

Preserve:

- Existing layout and visual hierarchy.
- Color palette and typography.
- Hero section and narrative experience.
- Animation behavior.
- Navigation appearance.
- Component styling.
- Product-card design.
- Responsive behavior.
- Accessibility.
- Existing functional features.
- Existing page structure wherever possible.

The objective is to improve data architecture and introduce approved functionality without changing the visual identity.

Avoid unnecessary refactoring.

Do not introduce new frameworks, state-management systems, styling libraries, or carousel libraries when existing project functionality can be reused.

# 3. MANDATORY WORKFLOW

Follow this sequence for every development phase:

Inspect → Plan → Approve → Implement → Verify → Report → Stop.

Only implement a phase explicitly approved by the owner.

After completing an approved phase, report:

1. Files changed.
2. Database changes.
3. Commands executed.
4. Tests passed.
5. Tests failed.
6. Tests not applicable or not run.
7. Screenshots reviewed.
8. Data imported or modified.
9. Security checks.
10. Outstanding blockers.

Do not continue to another phase without approval.

Small changes within the approved phase may be completed without separate approval when they do not materially change scope, architecture, behavior, or dependencies.

Stop and obtain approval before:

- Expanding scope.
- Changing architecture.
- Installing new packages.
- Applying destructive migrations.
- Modifying production records.
- Publishing products.
- Deploying to production.
- Changing business-critical behavior.

Never commit or push unless explicitly instructed.

Never use destructive Git commands.

Do not silently overwrite user changes.

# 4. DEVELOPMENT COMMANDS

Existing application commands:

- `npm run dev`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run preview`
- `npm run test:e2e`
- `npm run check:supabase` (read-only check of the `.env.local` credentials; prints no secrets)
- `python scripts/stage-catalogue.py <workbook.xlsx>` (regenerates `supabase/staging/*.sql` and `docs/catalogue-import-report.md`; stages drafts only)

Playwright uses the installed Chrome browser.

Do not download additional browsers without approval.

Supabase CLI has been introduced as an approved development dependency, version 3.1.0 in the Phase A implementation.

Inspect the installed version and discover supported commands using `--help`.

Do not assume CLI syntax.

Do not automatically upgrade Supabase dependencies.

# 5. APPROVED DEVELOPMENT PHASES

## Phase A — Supabase Schema and Security

Status (verified 10 November 2026):

Applied to the remote project `make-my-perfume` (ref `vqhomfpmybbhqskspegl`) and verified there: 10 tables, RLS on all, 3 `security_invoker` views, 8 read policies, no write grants for `anon` or `authenticated`, taxonomy seeded (7 categories, 6 families). The preflight found an empty public schema, so nothing could collide. The project is labelled production by the CLI.

Existing files:

- `supabase/migrations/20261110061340_catalogue_schema.sql`
- `supabase/migrations/20261110061345_catalogue_rls_and_views.sql`
- `supabase/migrations/20261110061349_catalogue_seed_taxonomy.sql`
- `supabase/migrations/20261110071341_catalogue_import_row_indexes.sql` (two foreign-key indexes from the performance advisor)
- `supabase/staging/workbook-2026-11-10.sql` and `supabase/staging/demo-products.sql` (generated; data, not migrations)
- `supabase/tests/staging.test.mjs`
- `supabase/preflight.sql`
- `supabase/rollbacks/20261110_catalogue_down.sql`
- `docs/catalogue-schema.md`
- `supabase/tests/catalogue.test.mjs`

Do not assume the remote schema exists until verified.

Do not rerun migrations blindly.

Inspect preflight results before applying schema changes.

The Phase A migrations are reported to contain a guard against existing catalogue tables. If preflight reveals any table-name conflict, stop and reconcile the existing schema instead of bypassing the guard.

Local in-memory PostgreSQL tests are not equivalent to remote Supabase verification.

Phase A is not complete until the target environment and actual migration application have been verified. Both have been (see above). Database recovery arrangements (backups, point-in-time recovery) were not inspected: the database was empty when the migrations ran.

## Phase B — Product Migration

Import available legacy-site products as drafts only.

Never publish automatically.

Status: workbook staged on the remote project as 14 draft parents and 35 inactive variants (36 import rows: 24 pending, 11 flagged, 1 rejected for a price of 0). The six concept products are stored as drafts. Nothing is published, approved, named, categorised or priced for sale. See `docs/catalogue-import-report.md`.

## Phase C — Category Architecture

Update shopping categories and navigation while preserving the existing visual design and legacy route compatibility.

Status: implemented and tested locally. The header and `/collection` follow the approved taxonomy; `?audience=`, `?type=`, `?family=` and `?collection=` all work. The storefront reads Supabase and falls back to the bundled concept catalogue while nothing is published (`src/data/repository.ts`, `VITE_CATALOGUE_SOURCE=local` forces the fallback).

## Phase D — Homepage Carousels

Add Latest Arrivals and On Sale using approved, published product data only.

Status: implemented. Tested locally against clearly labelled test fixtures (the remote project has nothing published) and against the same view logic on a local database. Not yet verified against real eligible remote data: that needs the owner to publish a product.

## Phase E — Regression Testing and Handover

Verify database integrity, frontend behavior, accessibility, responsive layout, and existing features.

Phases B to E were approved by the owner on 10 November 2026 and executed in one pass. Future work is not approved.

# 6. SUPABASE DATABASE RULES

Supabase is the planned authoritative catalogue database after the remote schema is verified and the integration is approved.

Before any database operation:

- Confirm the correct Supabase project.
- Confirm the target environment.
- Inspect existing tables and relationships.
- Review pending migrations.
- Check for conflicting schema objects.
- Verify database recovery arrangements.
- Confirm the operation is within the approved phase.

Never execute destructive operations without explicit approval.

Never drop existing business tables to satisfy a migration.

Never overwrite customer data, orders, or verified catalogue information.

Avoid duplicate tables and parallel schemas when existing structures can be reused.

## Security

Enable Row Level Security on exposed tables.

Public users may read only approved, published catalogue information.

Draft products, internal source records, inventory quantities, import logs, and administrative data must remain protected.

Use explicit column selections in browser queries.

Do not use `select('*')` against tables whose public roles have column-level restrictions.

Never expose Supabase secret keys or service-role credentials in frontend code.

Do not grant unrestricted write access to anonymous or authenticated users.

Use trusted server-side operations for administrative writes.

Do not use user-editable metadata for authorization.

Views must be reviewed for Row Level Security compatibility.

Check exposed-schema permissions and RLS policies independently.

Verify behavior using the actual public and authenticated roles, not only an elevated database role.

Run available Supabase security and performance advisors before release.

A passing SQL test is not proof that the application is secure.

# 7. PRODUCT DATA SOURCE AND MIGRATION

The original prototype catalogue exists in:

`src/data/legacy`

This directory is preserved as historical reference data.

Do not directly alter its original product facts.

The new product catalogue will be sourced from Supabase after the relevant implementation phase is approved and verified.

Until that point, retain existing frontend behavior.

Do not switch the application to an empty or unverified Supabase catalogue.

The current migration reference is:

`Make_My_Perfume_Website_Catalog_Instagram_Audit_2026-11-10.xlsx`

This workbook contains a partial extraction from:

https://www.makemyperfumestore.com/

The workbook is NOT a complete, client-approved inventory master.

Do not assume that every product on the live website is represented in the workbook.

If the workbook cannot be found, report that limitation and do not invent its contents.

## Import requirements

- Preserve source product names.
- Preserve source URLs where available.
- Preserve original extracted prices.
- Normalize product information without changing its commercial meaning.
- Group only verified variants under the same parent product.
- Create stable unique SKUs.
- Record import provenance.
- Identify duplicate records.
- Flag ambiguous product identities.
- Keep unverified values pending review.
- Import into draft status.
- Make migration scripts idempotent.

Do not invent:

- Product names.
- Prices.
- Bottle sizes.
- Product descriptions.
- Fragrance notes.
- Stock quantities.
- Images.
- Ratings.
- Reviews.
- Discounts.
- Manufacturing claims.

Never convert missing stock information into an assumption of available stock.

Never treat an extracted ₹0 price as an approved retail price.

Never use unverified competitor imagery as official product imagery.

## Existing six concept products

The existing app contains:

- Citrus Noir
- Amber Veil
- Nocturne
- Azure Skin
- Velvet Fig
- Saffron Neroli

These six products are not confirmed as part of the current live retail inventory.

Preserve them as unverified concept or legacy records.

Do not publish them as real commercial products without approval.

Do not permanently delete them.

# 8. PRODUCT CATEGORY ARCHITECTURE

The approved target shopping taxonomy is:

1. Shop All Perfumes
2. Men's Perfumes
3. Women's Perfumes
4. Unisex Perfumes
5. Inspired Fragrances
6. Personalized Perfumes
7. Gift Sets & Combos

These are proposed structural categories, not proof that matching products are currently available.

Categories must not contain invented or arbitrarily classified products.

Do not infer gender or fragrance family solely from a product title.

Keep empty commercial collections hidden from public navigation unless they are explicitly approved landing pages.

## Fragrance families

Retain:

- Fresh
- Warm
- Woody
- Aquatic
- Sweet
- Floral

These are product-discovery attributes, not the exclusive retail category system.

A fragrance may belong to multiple families when supported by verified product information.

Preserve existing filtering compatibility.

Both of the following should remain valid:

`/collection?family=Woody`

`/collection?collection=Woody`

## Navigation

Keep the existing header appearance.

Update only approved labels and destinations.

Proposed routes:

- Home: `/`
- Shop All Perfumes: `/collection`
- Men's Perfumes: `/collection?audience=men`
- Women's Perfumes: `/collection?audience=women`
- Unisex Perfumes: `/collection?audience=unisex`
- Inspired Fragrances: `/collection?type=inspired`
- Create Your Perfume: `/make`
- Gift Sets & Combos: `/collection?type=bundle`

These routes must not be exposed as populated collections until matching approved products exist.

Hide unused legacy navigation:

- Cosmopolitan
- Fusion
- Combo Deals
- Accessories
- Others

Preserve existing supported URLs or introduce safe redirects.

Do not delete underlying historical records.

The `/make` page remains Coming Soon until a functioning perfume builder is separately approved.

# 9. HOMEPAGE CAROUSEL REQUIREMENTS

Two new homepage sections are planned:

## Latest Arrivals

Display recently published, approved products.

Use actual Supabase catalogue information.

Sort by verified publication date.

Reuse existing product-card styling.

Do not display drafts or unapproved products.

Do not display placeholder products simply to populate the section.

Hide the section when no eligible products are available.

## On Sale

Display only approved products with genuine active discounts.

Requirements:

- Valid current price.
- Verified original price or approved promotion.
- Correct discount calculations.
- Accurate variant pricing.
- Existing product-card styling.
- Correct product-detail links.

Do not fabricate original prices.

Do not invent discount percentages.

Do not classify a product as discounted merely because it has a selling price.

Hide the carousel when no valid sale products exist.

## Visual rules

Both carousels must:

- Preserve existing typography.
- Preserve existing colors.
- Reuse existing components.
- Maintain responsive spacing.
- Support touch scrolling.
- Support keyboard accessibility.
- Respect reduced motion.
- Avoid unnecessary dependencies.

Do not modify the existing hero or unrelated homepage sections.

Prefer derived Supabase catalogue queries or existing public views rather than creating duplicate carousel product tables.

# 10. HARD CONTENT AND IMAGE RULES

No video anywhere.

Do not use, review, or process the reel.

No FFmpeg.

Original assets in `Make my perfume/` are read-only.

Derived files must be stored elsewhere.

Poster assets pairing house and competitor products may be used only when an individually verified crop contains the house bottle alone.

No competitor bottle, branding, reflection, or baked-in text may remain.

A crop must pass:

`docs/crop-audit.md`

and receive owner review before entering application assets.

## Legacy-site imagery

Owner decision: 16 October 2026.

Only two previously approved unbranded legacy images may be used as captioned editorial mood imagery:

- Sunflowers.
- Spray still life.

They must not be represented as product photography.

The six branded legacy images and the amber-bottle image remain excluded.

Unverified product imagery must retain the existing "Imagery pending" treatment.

Any newly supplied product photography requires separate verification and approval.

Instagram images must not be automatically imported as approved product images.

# 11. BUSINESS CONTENT RULES

Never display invented:

- Ratings.
- Reviews.
- Testimonials.
- Sale prices.
- Statistics.
- Product sizes.
- Fragrance longevity claims.
- Sillage claims.
- Ingredient claims.
- Company details.

Preserve the existing approved footer contents, including social links, Company Info, Support, `hello@makemyperfume.in`, and "Made in India", unless the owner explicitly approves changes.

The previous owner decision to avoid prototype notices and placeholder tags in the UI remains in force, except where the existing checkout or Coming Soon experience must truthfully disclose functionality limitations.

Checkout remains unconnected.

The shopping bag must clearly state that no real order is placed and no payment is charged.

The profile remains device-local unless authentication is separately approved.

Introducing Supabase catalogue reads must not silently activate checkout, authentication, orders, or payment processing.

# 12. IMPLEMENTATION RULES

Follow Scroll-Craft methodology.

Do not copy the Scroll-Craft engine.

Use page-local React hooks unless existing application architecture explicitly requires otherwise.

Design reference:

`C:\Users\HP\Desktop\scroll-craft\plugins\nateherk-design\skills\scroll-craft\references\taste.md`

Design tokens remain in:

`src/styles/tokens.css`

This is the single source of color values.

Do not introduce conflicting hardcoded theme values.

Allowed animation properties:

- transform
- opacity
- clip-path

Every motion must include a reduced-motion alternative that preserves meaning.

Do not introduce:

- Gradient text.
- Unapproved glows.
- Scroll cues.
- Section counters.
- Visible em dashes.
- Invented figures.
- Unapproved motion effects.

# 13. APPROVED MOTION EXCEPTIONS

The following existing exceptions remain approved:

- `stroke-dashoffset` for the one-time hero sprig draw.
- Registered color-property transitions using `--glow`, `--mid`, and `--deep` in `src/styles/motion.css`.
- Static `filter: blur()` on Drydown stains.

Other animated properties require approval.

# 14. NARRATIVE SYSTEM

Preserve the narrative:

"From Nature to Signature"

All text, links, and shopping actions must remain real HTML in normal document flow.

Decorative scenes must be `aria-hidden`.

The Still tier must provide a complete experience without WebGL or animated scenes.

Native scrolling only.

Two sticky stages remain approved:

- Drydown.
- Continuous 3D sequence.

No additional scroll pinning.

The collection must remain reachable early through the hero action and compact header.

Three.js remains restricted to:

`src/narrative/scene/`

It is loaded on demand for the Full tier when:

- Desktop width is at least 1024px.
- WebGL2 is available.
- Motion is allowed.

Procedural lighting only.

Implied hand only.

House bottle remains a stylized illustration with generic lettering.

Any scene failure must gracefully return to Still.

Do not modify the narrative architecture as part of catalogue, category, or carousel work.

# 15. VERIFICATION

After every approved change set, run:

- Typecheck.
- Unit tests.
- Production build.
- Relevant end-to-end tests.

For Supabase changes, additionally verify:

- Schema state.
- Migration status.
- Table relationships.
- RLS.
- Public read restrictions.
- Administrative write restrictions.
- Import counts.
- Product status.
- Variant relationships.
- SKU uniqueness.
- Price constraints.
- Data integrity.
- Existing records preserved.

When the Supabase project is linked, run available database linting and security/performance advisor checks.

Do not claim successful remote verification using only local tests.

## Visual regression

Review at:

- 1440 × 900.
- 390 × 844.
- 360 × 640.
- Reduced-motion mode.

Read screenshots directly.

Compare before and after screenshots of unaffected sections.

Contact sheets may be generated using Sharp without FFmpeg.

FFmpeg remains excluded.

A real phone is not covered by headless browser testing.

## Design acceptance

No unintended changes to:

- Homepage hero.
- Narrative sections.
- Header appearance.
- Typography.
- Colors.
- Buttons.
- Product-card styling.
- Page transitions.
- Responsive layout.
- Existing motion effects.

Only explicitly approved new components and navigation/data changes may alter visible UI.

# 16. COMPLETION STANDARD

Never report a feature complete merely because code was written.

A phase is complete only when:

1. The approved implementation exists.
2. Relevant tests pass.
3. Data changes are verified.
4. No unapproved feature changes occurred.
5. Security requirements are satisfied.
6. Visual regression is reviewed.
7. Outstanding limitations are documented.
8. A phase-completion report is delivered.

The final report must distinguish:

- Implemented.
- Tested locally.
- Verified against remote Supabase.
- Pending approval.
- Blocked.
- Not implemented.

Do not declare product migration complete when records have only been staged locally.

Do not declare a carousel complete unless it has been tested against eligible data.

Do not declare production readiness without explicit owner acceptance.

# 17. CURRENT PROJECT STATE

Verified on 10 November 2026:

- Implemented and verified against remote Supabase: Phase A schema (4 migrations applied; table, RLS, grant, view and policy checks; `anon` and `authenticated` roles tested on the live database; security and performance advisors run, no warnings or errors); Phase B staging (live row counts and idempotent re-run).
- Implemented and tested locally: category architecture, Supabase catalogue reads with fallback, size selection and sale display on the product page, Latest Arrivals and On Sale carousels. 110 unit tests and 110 end-to-end tests pass.
- Pending owner approval: publishing any product; display names for staged products (the workbook names real designer brands); audience, Inspired and scent-family assignments; prices and stock confirmation; images.
- Not implemented: authentication, checkout, payments, orders, administrative tooling, the `/make` builder (still Coming Soon), production deployment. The Vercel `api/config.js` function exists but is not deployed, and the deployment needs `SUPABASE_PROJECT_URL` and `SUPABASE_ANON_KEY` set.
- Existing UI preserved: homepage, collection and product pages are pixel-identical below the header at 1440 px and 390 px; only the header links changed.
- Nothing committed or pushed. Production deployment not approved.

These are facts as of the date above, not permanent assumptions.

Reinspect the repository and Supabase environment at the beginning of each new session.

Update this section only after verified phase completion.

The next phase must be explicitly authorized by the owner.

---

## FINAL NON-NEGOTIABLE RULE

Preserve the Make My Perfume experience.

Change the catalogue architecture and approved functionality without damaging the existing design.

Never invent commercial data.

Never bypass Supabase security.

Never execute unapproved destructive operations.

Never expand the approved phase.

Inspect. Implement. Verify. Report. Stop.
