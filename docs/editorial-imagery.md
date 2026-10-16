# Editorial imagery from the legacy site

Owner decision, 2026-10-16: use the legacy site's images that show no visible
branding, as atmospheric editorial imagery only. Never as product photography;
every product keeps its "Imagery pending" art.

Source: the 9 Unsplash images referenced by https://makemyperfume.vercel.app/
(bundle `index-BCV9-Ezs.js`, also served by `/api/products`). Downloaded at
1400px wide, then derived with sharp into `src/assets/editorial/`.

| Unsplash image | Verdict | Use |
|---|---|---|
| `photo-1455659817273-f96807779a8a` (sunflowers) | **Used** as `sunflowers-{800,1400}.webp` | Stage 1, ingredients mood |
| `photo-1622618991746-fe6004db3a47` (warm spray still life, unbranded bottles) | **Used** as `spray-still-life-{800,1400}.webp` | Stage 4, ritual mood |
| `photo-1588405748880-12d1d2a59f75` (amber square bottle on linen) | Excluded (owner): no text, but the bottle shape resembles a known designer bottle (trade-dress risk) | none |
| `photo-1547887538-e3a2f32cb1cc` | Excluded: NARS branding | none |
| `photo-1587017539504-67cfbddac569` | Excluded: Versace Eros | none |
| `photo-1594913615593-e4b8c44625be` | Excluded: Chanel No 5 | none |
| `photo-1643797517714-a273548abc3c` | Excluded: "SM" brand mark | none |
| `photo-1717852885839-166ce0621811` | Excluded: Ex Nihilo Blue Talisman | none |
| `photo-1758871993077-e084cc7eca86` | Excluded: Ustraa (three products) | none |

Licence: the Unsplash License permits free commercial use without attribution
(it does not allow selling unaltered copies or building a competing image
service). Captions on the site say "Stock photograph, illustrative" so the
images are never mistaken for our products. Photographer names were not
available from the legacy site.

Reference screenshots of the legacy pages are kept in
`scrollcraft/lab/legacy-site/` (git-ignored). They contain the excluded branded
images, so they are reference only and are not used anywhere in the site.
