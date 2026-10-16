# Make My Perfume: prototype brief

Status: **Storefront pages, legacy header/footer and tag removal complete,
awaiting review.** Plan approved 2026-10-15; redesign, motion pass and the "From Nature
to Signature" narrative approved 2026-10-16.

Sources are labelled throughout. **User** means the owner's own words (quoted) or
an explicit decision they made. **Authored, approved** means proposed during
planning and approved. Nothing here is a fabricated user quotation.

This brief was reconciled on 2026-10-16: sections 2 to 9 describe what is built
and approved now. Decisions that were superseded are listed in section 14 so the
history stays honest.

---

## 1. Scope

A frontend-only UI prototype. User: "Build a highly creative, innovative,
premium UI prototype for Make My Perfume. This is a frontend demonstration, not
a production ecommerce system." The new site should be "substantially more
creative, immersive, and visually polished than the old site."

In scope: a narrative homepage ("From Nature to Signature"), the scroll-driven
Drydown, collection, product details, search and filters, a personalised
fragrance builder (note selection and a personalised label), client-side bag,
About, Contact, 404, responsive navigation, transitions, loading states,
reduced motion.

Out of scope (user): backend, database, authentication, payments, shipping,
GST invoicing, transactional email, admin, deployment. **No video anywhere**;
the supplied reel is not used, reviewed or processed, and FFmpeg is not
installed.

Every simulated behaviour says so on its face: provisional prices, the
illustrative custom-blend price, a checkout dialog that does not take payment,
a contact form that does not send, a builder that is not connected to
production.

## 2. The eight Step 0 topics (current)

| # | Topic | Answer | Source |
|---|---|---|---|
| 1 | Vibe | Warm parchment editorial pages with noir bands; black, gold, ivory from the logo; premium, creative, immersive. Layout informed by the Trefume Dribbble reference (inspiration only) | User (palette, ambition, reference) |
| 2 | Journey | Ingredients, Composition and families, Bottle and collection, Ritual (spray), Drydown, Signature and Make yours | User-approved narrative order |
| 3 | Energy curve | Calm open, gathering, appetite, a decisive gesture, the held Drydown, a still resolve | Authored, approved |
| 4 | Feeling and the one moment | See section 4 | Authored, approved |
| 5 | Something no other site does | The Drydown: scroll is time on skin. The narrative hands the spray onto its paper strip | Authored, approved |
| 6 | Distance from premium-minimal | Editorial premium with one gold accent; black and gold are the brand's own colours | User palette |
| 7 | One world or distinct scenes | One continuous central scene (3D in later phases) beside normal-flow content, plus the separate Drydown band | User-approved narrative |
| 8 | Assets | Logo, eight posters (reference only; house bottles beside competitor products), the excluded reel, six provisional legacy products. No approved photography | User supplied |

## 3. Grammar, signature move, fingerprint

- **Grammar:** editorial storefront with a sticky central scene ("scrollytelling
  graphic"). Content always stays in normal document flow beside or around the
  scene; the scene is decorative. Pinning is reserved for the Drydown.
- **Signature move: the Drydown.** A paper smelling strip held on screen while
  scroll stands for time on skin: top notes lift and fade, the heart blooms, the
  base settles and stays, on one continuous time rail. Time is worded ("The first
  minutes", "The first hours", "What stays"), never invented hour figures.
- **Narrative bookend:** "Your scent. Your signature." opens the page (hero
  `h1`) and closes it (stage 5 `h2`), both real HTML (user decision).
- **Fingerprint gate:** `scrollcraft/FINGERPRINTS.md` is empty; nothing to clear.

## 4. Journey, feeling curve, peak

| # | Stage | Feeling | What is on screen | Content in the composition |
|---|---|---|---|---|
| 1 | Ingredients | Calm curiosity | Line-drawn ingredients around the glass flask of the seal | Hero copy beside the scene; "Shop the collection" jumps straight to stage 3 |
| 2 | Composition | Gathering | A liquid accord; families arranged around it, each previewing its colour | Point of view; six family filter links with one catalogue scent each |
| 3 | Bottle | Appetite | The house bottle illustration takes the light of the scent being read | Collection header, provisional tags, six product cards with Add to bag |
| 4 | Ritual | A decisive gesture | Cap off, a burst of mist (implied hand, user decision) | "Built to leave a mark." (poster tagline) |
| 5 | Drydown (existing) | Awe, then intimacy | The spray lands on the strip; the day on skin unfolds | Scent chooser, notes by layer, product link |
| 6 | Signature | Resolve | The bookend phrase, then the label | Real-HTML heading, Make yours form, Start your blend, Shop the collection |

- **Peak:** the Drydown. **Tell-someone sentence:** it's the site where a
  drawing turns into a perfume, and the spray lands on a paper strip you watch
  dry down.
- **Not repeated:** families appear only in stage 2; top/heart/base layering
  appears only in the Drydown; evaporation belongs to the Drydown, the spray to
  the Ritual.

## 5. Design direction (current: "Atelier")

- **Colour (tokens in `src/styles/tokens.css`):** parchment `#F1EDE6`, band
  `#E6E0D6`, paper `#FAF8F4`, ink `#1A1612`, muted `#5E554B`, deep gold text
  `#7A5A22`, decorative gold `#C99A4B` (never text, 2.2:1), noir `#14110E` with
  ivory `#F2E8D5`, ivory-soft `#B3A690` and gold `#D5A35D`. `.noir` re-keys the
  semantic roles and restates `color`. Family material palettes live in
  `src/lib/palettes.ts` and are material colours only, never UI accents.
- **Type:** Cormorant Garamond (display, roman and italic) and Jost (text, UI).
- **Shape:** pill controls, 16px frames; the flask silhouette of the seal is the
  brand window; shouldered card frames.
- **Imagery:** original CSS/SVG material art, always labelled "Imagery pending"
  where it stands in for photography. No poster crops, Unsplash or competitor
  imagery.
- **Floor:** Scroll-Craft taste.md; 4px spacing scale;
  `cubic-bezier(0.23,1,0.32,1)`; motion through transform, opacity and
  clip-path, with the exceptions recorded in `CLAUDE.md`. No gradient text,
  glows, scroll cues, section counters, visible em dashes or invented numbers.

## 6. Assets and content rules

- Originals in `Make my perfume/` are never written to; SHA-256 table in
  section 9 with its recheck history.
- Business location is unverified; the footer stays location-free.
- Logo: RGB with no alpha; shown inside a circular clip, enlarged so the clip
  falls on its black rim (works on light and noir grounds).
- Posters: visual reference only. Candidate crops (`docs/crop-audit.md`) remain
  in the lab and are **not** used anywhere (user decision).
- Legacy site: no original imagery. Six products used as provisional content,
  marked carried over and pending confirmation. Facts are never edited.
- Excluded until confirmed: ratings, reviews, testimonials, sale prices,
  performance claims (longevity, sillage, bestseller), ingredient lists, contact
  details, location, policies, shipping, tax, and the unverified manufacturing
  claims ("small batches, in India", "Made in India", "vegan").
- Prices in INR. Custom-blend pricing labelled illustrative.
- The house bottle appears only as a stylised illustration with generic
  lettering, captioned as an illustration. The amber bottle is not used.

## 7. Architecture

- Vite + React + TypeScript (strict), React Router (lazy routes with loaders),
  CSS custom properties with CSS Modules, Zustand persisted to localStorage
  through a safe adapter (versioned keys).
- **Data:** `src/data/repository.ts` exposes async functions over the local
  snapshot so a backend can replace the bodies later. Bag: `src/store/bag.ts`.
- **Motion:** the Scroll-Craft engine is **not** copied in.
  `src/scroll/scheduler.ts` (one passive scroll + resize listener, rAF
  coalesced, near-viewport subscribers), `useScrollProgress` (`pinned`, `exit`),
  `src/scroll/reveal.ts` (one shared observer, once-only reveals, pre-hidden only
  under `html.motion-ok`, revealed on focus and print). The Drydown is CSS
  driven by `--p`.
- **Narrative (section 13):** `src/narrative/` holds the stage timeline, the
  capability tier and the scene controller interface. Phase 2 adds a Three.js
  scene behind the same content; the static composition is the complete
  fallback.
- **Verification:** Playwright on the installed Chrome (`e2e/`), axe, rendered
  contrast with pixel sampling, focus-ring contrast; sheets from
  `scripts/contact-sheet.mjs` (sharp). Scroll-Craft `shoot.mjs` is not used: it
  depends on the engine's markers and on FFmpeg for sheets; `doctor.mjs`
  failing on FFmpeg is an accepted deviation.
- Routes: `/`, `/collection`, `/product/:slug`, `/make`, `/bag`, `/about`,
  `/contact`, `/foundation` (unlinked specimen), 404. Unbuilt routes show an
  honest "still being composed" page.

## 8. Phases (current)

Done: Phase 0 setup; Phase 1 foundation; redesign Milestone 1 (identity,
shell, homepage); Milestone 1 motion pass; narrative Phase 1.

Next, each gated by owner approval:

1. **Narrative Phase 2:** install `three` + `@types/three` (versions verified),
   scene stages 1 to 3 behind the static composition, measured bundle size.
2. **Narrative Phase 3:** stages 4 and 5, mist into type, Drydown handoff.
3. **Narrative Phase 4:** performance profiling; Lite tier only if profiling
   supports it; full verification.
4. **Milestone 2:** collection page, product page, bag.
5. **Milestone 3:** builder, About, Contact, designed 404, builder view
   transition.
6. Final verification and report; FINGERPRINTS row.

## 9. Phase 0 record

### Original asset fingerprints (SHA-256)

Recorded before any Phase 0 change; every file matched at every recheck since
(after Phase 0, the Phase 0 audit, Phase 1, Milestone 1, the motion pass, the
narrative investigation and narrative Phase 1). The reel is listed for
completeness only: it is excluded and never opened, reviewed or processed.

| File | SHA-256 |
|---|---|
| `Logo/Make my perfume logo.png` | `dd0a24a4472a4c7f79e607a2b3a4771514cc946359363b4c205540182856d76b` |
| `posters/MMP (1).png` | `ccf9c658bf248f455905d2891bb9e607ece93a36f4bb52e5c16eafbf068a0347` |
| `posters/MMP (2).png` | `08ecbb9af15967577a537d578e06d115e653bd676636fff6d143155ac9aca625` |
| `posters/MMP (3).png` | `de85e5af0326d2a5412630022685e49e6cf7cf248a9b3bce98c31f667d30691c` |
| `posters/MMP (4).png` | `2474c4bdc3d446c965cd767f02ba07a7782409a12d46c2894de510f3f890f2e4` |
| `posters/MMP (5).png` | `812d95f486fddd0f325d22aae8bc72d608bd97058cb90ac1bd93216136eaa856` |
| `posters/MMP (6).png` | `354a168baf655c86ad7bdea215594d80dd09d53e2a49f5627d8a9390fe9079b0` |
| `posters/MMP (7).png` | `283c19a087310b610617ccd1a654707685c9e05b5c09c3f6e783380f61a98f46` |
| `posters/MMP (8).png` | `c93c37b0ed70fc26b3d8a1377ef642f1032fc6998eac13774268d17eaad8bbaf` |
| `videos/MMP reel 1.mp4` (excluded) | `2dfdf611600a3b73ddd0efb876d697ec41c4d736d6f49f3dee5b918b6d8f58f0` |

Paths are relative to `Make my perfume/`.

### Dependencies (current)

| Package | Version | Kind | Reason |
|---|---|---|---|
| react, react-dom | 19.3.1 | runtime | UI |
| react-router | 8.4.0 | runtime | Routes, lazy pages, loaders |
| zustand | 5.0.15 | runtime | Bag, builder draft |
| lucide-react | 1.57.0 | runtime | Icon set |
| @fontsource/cormorant-garamond, @fontsource/jost | 5.3.0 | runtime | Self-hosted brand fonts (Cinzel removed in Milestone 1) |
| vite | 8.3.4 | dev | Dev server and build |
| @vitejs/plugin-react | 6.1.2 | dev | React transform |
| typescript | 7.0.2 | dev | Type checking (native compiler) |
| @types/react, @types/react-dom | 19.3.0 | dev | React 19 ships no types |
| vitest | 5.0.5 | dev | Unit tests |
| @testing-library/react, @testing-library/dom | 16.3.3, 10.4.2 | dev | Component tests |
| jsdom | 30.1.3 | dev | DOM for component tests |
| @playwright/test, playwright-core | 1.64.1 | dev | Browser tests |
| @axe-core/playwright | 4.14.0 | dev | Accessibility checks |
| sharp | 0.35.5 | dev | Image derivation and contact sheets |

Added 2026-10-16: `three@0.186.1` (runtime; no runtime dependencies of its own)
and `@types/three@0.186.0` (dev; pulls six dev-only packages: `@types/webxr`,
`@types/stats.js`, `fflate`, `meshoptimizer`, `@tweenjs/tween.js`,
`@dimforge/rapier3d-compat`, none bundled). No system packages. No FFmpeg. Playwright browsers not
downloaded. `@types/node` deferred (e2e files are transpiled, not type-checked).

## 10. Phase 1 record (foundation)

Tokens, base and materials styles, fonts, derived brand assets
(`scripts/derive-brand.mjs`), catalogue utilities, core components, routes, the
`/foundation` specimen page, crop candidates and audit (`docs/crop-audit.md`),
and the first browser verification. The original dark Cinzel identity of this
phase was replaced in Milestone 1 (section 14).

## 11. Redesign Milestone 1 record (Atelier identity, shell, homepage)

Approved 2026-10-16. Trefume reference used for inspiration only. Atelier
tokens, Cormorant Garamond replacing Cinzel (lockfile: one removed, one added),
flask and shoulder masks, CSS material art, repository, bag and toast stores,
header with search and bag, `<dialog>` mobile menu, noir footer, prototype
notice, the first homepage. Verified by `e2e/m1.spec.ts` and unit tests.

## 12. Milestone 1 scroll-animation record

Approved 2026-10-16. Shared scheduler and reveal observer; hero decant and
desktop-only depth; family band entrance and controls; card decant; light
entrances; Drydown continuous rail, stain movement, colour and notes
cross-fades, tighter spacing after the sticky stage. Verified by
`e2e/motion.spec.ts`; sheets in `scrollcraft/lab/motion/`.

## 13. Narrative "From Nature to Signature"

User decisions (2026-10-16): Three.js with `@types/three` in later phases, no
React Three Fiber or Drei; implied hand only; stylised code-built matte-black
house bottle with generic lettering, posters as reference only, no amber
bottle; order Ingredients, Composition and families, Bottle and collection,
Spray, Drydown handoff, Signature and Make yours; compact sticky header; the
bookend phrase as real HTML; mobile prioritises a polished Still experience
(Lite only if profiling supports it); procedural lighting only; narrative
before Milestone 2 in gated phases. The collection must be reachable early.

### Phase 1 record

- **Structure:** `src/narrative/timeline.ts` (stages, track lengths, scene
  parameters as pure functions), `src/narrative/tier.ts` (Full, Lite, Still;
  resolves to Still until a 3D renderer exists), `src/narrative/scene/types.ts`
  (controller interface for Phase 2).
- **Track lengths (reconsidered):** Track A (stages 1 to 4) about 3.9 viewport
  heights on desktop instead of the proposed 5.8; Track B (signature) about 0.9
  instead of 1.2. In the Still tier sections take their natural height; the
  lengths apply only when a scene runs.
- **Static composition:** see section 4; the compact header, the early
  collection jump, families around a CSS accord with hover/focus preview, the
  bottle illustration lit by the card in view, the static spray, and the
  signature heading.
- **Verification:** `e2e/narrative-still.spec.ts` plus updated `m1` and
  `motion` specs. Screenshots in `scrollcraft/lab/narrative-p1/`.

## 14. Superseded decisions (history)

- The dark Cinzel identity, "Exhibit one / Notes Room / Silence / Two Moods /
  Label close" journey and gallery grammar of the original plan were replaced
  by the Atelier redesign (Milestone 1) and then by the narrative order.
- "Canvas 2D for the Drydown" was never built; the Drydown is CSS driven by
  `--p`.
- `mix-blend-mode: lighten` for the logo was replaced by the circular clip.
- The `shoot.mjs` marker spike was dropped in favour of the project's own
  Playwright sampling.
- The horizontally scrolling family band (Milestone 1 motion pass) is replaced
  on the homepage by the families arranged around the accord in stage 2.

### Continuous 3D sequence record (2026-10-16)

Owner decisions: one continuous Three.js scene scrolled vertically (Drydown
after the sequence); legacy-site images limited to the two unbranded ones
(`docs/editorial-imagery.md`).

- **Order:** Ingredients, Composition and families, Bottle and collection,
  Ritual, Signature (bookend heading) inside one `.sequence` wrapper; then the
  Drydown; then Make yours.
- **Scene:** `src/narrative/scene/createScene.ts`: glass Erlenmeyer flask
  (transmission) filling with liquid; the brand's line glyphs and sprig drifting
  into the neck; a wobbling liquid accord recoloured through the families (and
  by family hover/focus); the matte-black house bottle built from its base,
  capped, turned once, lit by the family of the centred card; cap lifted, mist
  from the nozzle; 2,600 screen-space particles gathering into the real HTML
  heading's letters, then handing over to it. RoomEnvironment lighting only.
- **Sync:** `sequenceT()` measures the real stage blocks against a reading line
  (60% of the viewport) through the shared scheduler, so the scene follows the
  content whatever its height. Stage published as `data-verify-stage`.
- **Tiers:** decided synchronously on first render. Full on capable desktops;
  Still on phones, reduced motion, no WebGL2, data saver, low memory, load
  failure, context loss or slow frames (median > 24ms over 90 frames).
- **Bundle (measured):** scene chunk 618.4 kB, **159.8 kB gzip**, lazy; initial
  bundle unchanged at 106.6 kB gzip.
- **Verification:** `e2e/narrative-3d.spec.ts` (9) plus all prior suites (75
  total). Frames and sheet in `scrollcraft/lab/narrative-3d/`.

### Storefront record (2026-10-16)

Owner request: old site's header and footer contents in the house style; a
product grid page and homepage "Explore scents" and "Best sellers" in our style;
a marketplace-style product page; a profile button and page; remove the
prototype tag and placeholder text.

- **Header:** search, seal, profile and bag on row 1; the old categories (Home,
  Signature Perfume, Personalized Perfume highlighted in gold, Cosmopolitan,
  Fusion, Combo Deals, Accessories, Others) on row 2; all in the mobile menu.
  The old light/dark toggle was not added (no dark theme exists).
- **Footer:** Explore, Company Info, Support columns, Instagram/YouTube/
  Pinterest, © 2026, hello@makemyperfume.in, Made in India. Unbuilt targets
  (Careers, Blogs, FAQs, Track Order, Store Locator, About, Contact) show a
  "Coming soon" page.
- **Pages:** `/collection` (family chips, search, sort in the URL; empty states
  for categories with no products), `/product/:slug` (gallery with three views,
  price, listed size, quantity, Add to bag, Buy now, notes, Wear it well,
  Ingredients & details, related), `/bag` (quantity, remove with undo,
  subtotal, honest checkout dialog), `/profile` (validated details stored on
  the device, bag and orders summary).
- **Home:** Explore scents (six family tiles; sunflowers for Floral) and Best
  sellers (the first four, as on the old site) after the Drydown.
- **Removed:** prototype notice, carried-over/provisional/imagery-pending tags,
  illustration and stock captions, prototype wording. Kept out: ratings,
  reviews, sale prices, and the old site's computed second-size prices.
- **Verification:** `e2e/shop.spec.ts` (21) plus all suites: 96 browser checks,
  70 unit tests. Screenshots in `scrollcraft/lab/shop/`.
