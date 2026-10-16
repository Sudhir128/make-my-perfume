# Make My Perfume: frontend prototype

A frontend-only UI prototype. Sample content and prices, no backend, no real
orders or payments. Scope, design direction and phases live in
[scrollcraft/builds/make-my-perfume/BRIEF.md](scrollcraft/builds/make-my-perfume/BRIEF.md).

```bash
npm install
npm run dev         # local dev server
npm run typecheck   # TypeScript project build, no emit
npm test            # Vitest unit tests
npm run build       # type check + production build to dist/
npm run preview     # serve dist/ on http://localhost:4173
npm run test:e2e    # Playwright on installed Chrome (specs from Phase 2)
```

`node scripts/snapshot-legacy.mjs` refreshes the provisional product snapshot
from the legacy site's API.

Supplied originals in `Make my perfume/` are never modified.
