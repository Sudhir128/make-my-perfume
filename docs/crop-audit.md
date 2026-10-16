# Poster crop audit

Phase 1, 2026-10-16. Candidates are cut by `scripts/derive-crops.mjs` from the
boxes in `scripts/crops.json` into `scrollcraft/lab/crops/` (git-ignored, not an
app asset folder). The posters themselves are only read.

**Rule:** reject any crop that shows a competitor bottle or any part of one,
competitor branding, a competitor reflection or coloured light spill, or
baked-in promotional text. A passing crop is still **not** copied into
`src/assets/` until the owner has reviewed it.

Method: each candidate was opened at native resolution. Where the house bottle
sits close to a competitor, a wider diagnostic strip (`diag-p*.png`, 2×) was
cut to measure exactly where the competitor ends and the house bottle begins.
For the survivors, the left 40px column was also measured for a blue cast.

| Candidate | Source box (x, y, w, h) | Verdict | Reasons |
|---|---|---|---|
| `black-p4` | MMP (4): 640, 520, 420, 700 | **Reject** | YSL bottle ends at x≈622, house bottle starts at x≈652, so the box excludes the competitor itself. But the house bottle's lower-left flank carries a distinct blue cast consistent with spill from the adjacent blue YSL glass. Counts as competitor light spill. |
| `black-p8` | MMP (8): 646, 440, 440, 780 | **Reject** | Spicebomb ends at x≈640, house bottle starts at x≈651 (11px gap). A warm vertical highlight on the house bottle's left flank lines up with Spicebomb's gold band: a reflection of the competitor. The box cannot move further right without clipping the bottle. |
| `amber-p3` | MMP (3): 636, 540, 460, 660 | **Reject** | Armani ends at x≈630, house bottle starts at x≈635 (5px gap). The clear faceted glass refracts its surroundings beside the Armani bottle, and the caustics on the plinth at lower left cannot be ruled out as cast through the competitor. Not safe. |
| `black-p6` | MMP (6): 652, 510, 430, 700 | **Provisional pass** | Paco Rabanne Phantom ends at x≈630; house bottle starts at x≈670, so the box keeps a 22px buffer from the competitor and 18px of margin on the bottle. Background is the dark wall and textured stone only. Left-edge column mean RGB 47/45/43: neutral, no chrome or colour spill seen. Tagline text sits at y≈170-240, far above the box. Complete silhouette, cap to contact shadow. |
| `amber-p5` | MMP (5): 634, 580, 474, 670 | **Provisional pass** | Versace ends at x≈627; house bottle starts at x≈640, so the box excludes it by 7px and leaves 6px of margin on the bottle. Light falls from the right (Versace's shadow is cast to the left), so the warm caustics in front of the bottle come from the house bottle itself. Left-edge column mean RGB 203/152/86: warm, no blue from the Versace glass. Tagline text sits at y≈170-320, above the box. Complete silhouette. |

## Limitations

- Resolution: survivors are 430×700 and 474×670 source pixels (no
  upscaling). At 2× device pixel ratio they stay sharp only up to roughly
  215-235 CSS pixels wide. Larger use needs real product photography.
- The amber crop's left margin is tight (6px); it reads best inside a framed
  plate rather than full bleed.
- The two plates were shot in different poster sets (cool charcoal vs warm
  travertine). That suits the planned "Two Moods" diptych, but they do not
  match each other as a pair.
- Visual judgement was made on the decoded PNGs at native size. A finer
  reflection than the eye catches at that size cannot be fully excluded.

## Status

No crop has been copied into application assets. The site uses "Imagery
pending" plates until the owner reviews `black-p6` and `amber-p5`.
