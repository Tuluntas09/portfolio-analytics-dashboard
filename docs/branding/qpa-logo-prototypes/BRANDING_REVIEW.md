# QPA — Fused Frame Logo Prototypes (Review)

Temporary prototype files for visual review only. Nothing here is wired into the app.

## 1. Files created

- `prototype-a-readability.svg`
- `prototype-b-balanced.svg`
- `prototype-c-compact.svg`
- `preview-dark.svg`
- `preview-light.svg`
- `BRANDING_REVIEW.md`

## 2. Construction logic — Prototype A (Readability)

- **Q** is the outer rounded-square frame with a short diagonal tail breaking the lower-right corner.
- **P** sits in the upper-internal area as a complete letter: vertical stem plus a closed bowl.
- **A** sits in the lower-internal area as a complete letter: full apex, two legs, and a clearly separate crossbar.
- Each letter is drawn in full rather than fused, maximizing per-letter legibility at the cost of some density.

## 3. Construction logic — Prototype B (Balanced — recommended)

- **Q** is a near-square outer frame with a tail, giving an even, production-friendly footprint.
- A single **shared vertical stem** does double duty: it is **P's stem** and **A's left leg**.
- **P's** bowl branches off the top of the shared stem.
- **A's** right leg descends from the same apex, with a crossbar spanning the two legs — making the A more readable than the original written spec, which under-described it.
- Two letters (P and A) share structure, so the mark reads as one unified symbol.

## 4. Construction logic — Prototype C (Compact)

- **Q** frame is retained but drawn with a heavier stroke so the ring survives downscaling.
- The internal mark is reduced to a fused **P/A core**: one stem, one minimal bowl, one diagonal leg standing in for the A.
- Detail is stripped aggressively, but the stem + bowl + diagonal keep continuity with the full fused-frame concept rather than collapsing into a plain Q.

## 5. Small-size findings

- At **16px**, Prototype A's separate P and A blur together; the crossbar and apex are the first details to disappear.
- Prototype B holds the Q frame and the shared stem cleanly to ~20px; the bowl/leg distinction softens but the silhouette stays distinct.
- Prototype C is the most robust at 16px — the heavier stroke keeps the frame and core open and non-muddy.

## 6. Main legibility concern

The **A** is the weakest letter across all variants: its crossbar and second leg are the smallest features and are the first to merge at icon sizes. Prototype B mitigates this by sharing the stem and keeping a single explicit crossbar; Prototype C accepts a diagonal hint instead of a full A.

## 7. Recommended prototype

**Prototype B (Balanced).** It is nearly square, reads as one unified symbol, keeps all three letters identifiable, and degrades gracefully. Recommend unless live visual testing at 16–20px favors C.

## 8. Validation results

- All five SVGs are valid XML with a valid `viewBox`.
- `currentColor` used for all mark strokes.
- No raster images, no external resources, no gradients, no filters, no shadows, no animation.
- Each prototype works as a single flat color.

## 9. Scoring

| Criterion        | Prototype A | Prototype B | Prototype C |
| ---------------- | ----------: | ----------: | ----------: |
| Q readability    |        9/10 |        8/10 |        8/10 |
| P readability    |        9/10 |        8/10 |        6/10 |
| A readability    |        8/10 |        7/10 |        4/10 |
| Unified form     |        5/10 |        9/10 |        8/10 |
| 16px performance |        5/10 |        7/10 |        9/10 |
| Interface fit    |        6/10 |        9/10 |        8/10 |
| SVG simplicity   |        6/10 |        7/10 |        9/10 |
| Overall          |        7/10 |        9/10 |        8/10 |

## 10. Production files

No production files were modified. Only files inside `docs/branding/qpa-logo-prototypes/` were created. `src/`, `public/`, `index.html`, `README.md`, `package.json`, Vite config, favicon, and deployment files are untouched.
