# Make My Perfume: frontend prototype

Frontend-only UI prototype. No backend, database, auth, payments, shipping,
tax, email, admin or deployment. Full brief, design system and phase plan:
scrollcraft/builds/make-my-perfume/BRIEF.md (read it before any work).

## Workflow (mandatory)
- Inspect → plan → approve → implement → verify, one phase at a time.
- Do only the phase the owner has explicitly approved. Stop after it with a
  report: files changed, commands run and results, checks passed/failed/not
  applicable, screenshots read, blockers. Wait for approval before the next phase.
- Within an approved phase, related in-scope refinements (small CSS or component
  adjustments) do not need separate approval. Stop and ask before expanding
  scope, changing architecture, adding dependencies, or making a material
  decision outside the approved plan.
- Never install packages without approval.
- Never commit or push unless asked. Never use destructive git commands.

## Commands
npm run dev | npm run typecheck | npm test | npm run build | npm run preview
npm run test:e2e   (Playwright on installed Chrome; never download browsers)

## Hard content rules
- No video anywhere. Do not use, review or process the reel. No FFmpeg.
- Originals in "Make my perfume/" are never written to. Derived files go elsewhere.
- Posters pair our bottle with competitor products. Use only individually
  verified crops that show house bottles alone: no competitor bottle, branding,
  reflection or baked-in text. A crop enters app assets only after it passes
  the visual audit (docs/crop-audit.md) and the owner has reviewed it.
- Legacy-site images (owner decision 2026-10-16, docs/editorial-imagery.md):
  only the two unbranded ones (sunflowers, spray still life) may be used, as
  captioned editorial mood imagery, never as product photography. The six
  branded images and the amber-bottle image are excluded. Products keep
  "Imagery pending" art.
- Legacy products (src/data/legacy) are the catalogue. Do not edit their facts.
  Owner decisions 2026-10-16: no prototype notice or placeholder tags in the UI;
  the old site's header categories, footer contents (social links, Company
  Info, Support, hello@makemyperfume.in, "Made in India") and the product
  page's longevity, sillage and ingredients are shown as published there.
- Never display invented figures: ratings, reviews, testimonials, struck-through
  sale prices, statistics, or sizes/prices the catalogue does not list.
- INR prices. Checkout is not connected: the bag's checkout says plainly that no
  order is placed and nothing is charged. The profile is stored on the device
  only (no accounts).
- Never invent product names, prices, notes, claims or company details.

## Implementation rules
- Scroll-Craft methodology; do NOT copy its engine. Page-local React hooks only.
- Design floor: Scroll-Craft references/taste.md
  (C:\Users\HP\Desktop\scroll-craft\plugins\nateherk-design\skills\scroll-craft).
  Animate transform, opacity and clip-path only. No gradient text, glows,
  scroll cues, section counters, visible em dashes, or invented numbers.
- Tokens live in src/styles/tokens.css and are the single source of colour.
- Every motion has a reduced-motion version that keeps the meaning.

## Approved motion-rule exceptions
Beyond transform, opacity and clip-path, only these are approved:
- `stroke-dashoffset` for the one-time hero sprig draw (small SVG, once).
- Transitions of registered colour properties (`@property --glow/--mid/--deep`
  in src/styles/motion.css) for scent and family colour cross-fades.
- A static `filter: blur()` on the Drydown stains (not animated).
Anything else needs owner approval first.

## Narrative rules ("From Nature to Signature")
- All text, links and shopping actions stay real HTML in normal flow; any scene
  (CSS now, WebGL later) is decorative and `aria-hidden`.
- The Still tier is the complete experience: every stage must make sense with
  no scene running (reduced motion, no WebGL, phones by default).
- Native scrolling only. Two sticky stages are approved: the Drydown and the
  continuous 3D sequence stage (owner decision 2026-10-16). No other pinning.
- The collection stays reachable early (hero action, compact header).
- Three.js (approved) lives only in src/narrative/scene/, loaded on demand for
  the Full tier (desktop >= 1024px, WebGL2, motion allowed). Procedural
  lighting only; implied hand only; the house bottle is a stylised
  illustration with generic lettering. Any scene failure drops to Still.

## Verification
- Run typecheck, tests and build after every change set.
- Contrast is measured on real foreground/background pairs (unit tests on
  tokens, e2e on the rendered page), including muted text, gold text and
  focus indicators.
- Visual review: 1440×900, 390×844 and 360×640, plus reduced motion. Read the
  screenshots yourself. Contact sheets come from sharp (shoot.mjs needs FFmpeg
  for sheets; FFmpeg is excluded; doctor.mjs failing on FFmpeg is expected).
- Report what was not verified. A real phone is never covered by headless runs.
