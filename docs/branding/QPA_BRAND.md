# QPA Brand

**QPA** is the locked product name. Full name: **Quant Portfolio Analytics**.

## Mark

- **Approved mark:** Prototype B — *Fused Frame*.
- Source design: `docs/branding/qpa-logo-prototypes/prototype-b-balanced.svg` (prototypes are kept for reference; do not delete).
- Construction: a rounded-square **Q** frame with a corner tail; a single vertical stem serves as both **P**'s stem and **A**'s left leg; **P**'s bowl and **A**'s right leg + crossbar share the same apex — so the three letters read as one unified symbol.

## Production assets

| Asset | Path |
| --- | --- |
| Mark | `public/brand/qpa-mark.svg` |
| Wordmark | `public/brand/qpa-wordmark.svg` |
| Horizontal lockup | `public/brand/qpa-lockup-horizontal.svg` |
| Vertical lockup | `public/brand/qpa-lockup-vertical.svg` |
| Favicon (vector) | `public/favicon.svg` |
| Favicon 16 (raster) | `public/favicon-16.png` *(see Favicon behavior)* |
| Favicon 32 (raster) | `public/favicon-32.png` *(see Favicon behavior)* |
| Apple touch icon | `public/apple-touch-icon.png` *(see Favicon behavior)* |

## Usage rules

- SVG marks use `currentColor` — the mark inherits the surrounding text color, so it stays single-color and theme-aware.
- Keep the mark within the blue / teal / navy system. **Never** use green or red in brand assets.
- No gradients, filters, shadows, animation, raster content, or external resources inside brand SVGs.
- Maintain clear space around the mark roughly equal to the Q-frame corner radius.
- Wordmark and lockups render "QPA" in IBM Plex Sans (with a system sans-serif fallback stack).

## Dark / light theme usage

- **Dark backgrounds (deep navy):** render the mark in white or the accent blue.
- **Light backgrounds (cool white):** render the mark in navy or the accent blue.
- Because assets use `currentColor`, in-app the mark automatically follows `--text` / `--accent`.

## Favicon behavior

- `public/favicon.svg` is the primary favicon — a single fixed accent blue (`#3D7BE8`) chosen to stay legible on both light and dark browser tabs. All modern browsers use it directly.
- Raster fallbacks (`favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`) are for browsers without SVG favicon support and for iOS home-screen icons.

### ⚠ PNG generation deferred

The three PNG files are **not yet generated** — no SVG rasterizer (ImageMagick / rsvg / sharp) is available in the local environment. To avoid 404 requests in production, `index.html` currently links **only** the SVG favicon. Once the PNGs are produced with a reliable rasterizer, re-add the `<link rel="icon" type="image/png" ...>` and `<link rel="apple-touch-icon" ...>` tags.

To generate them from `public/favicon.svg` (run from `public/`):

```bash
# ImageMagick (with an SVG delegate such as librsvg)
magick -background none favicon.svg -resize 16x16  favicon-16.png
magick -background none favicon.svg -resize 32x32  favicon-32.png
magick -background none favicon.svg -resize 180x180 apple-touch-icon.png

# or with sharp-cli
npx sharp-cli -i favicon.svg -o favicon-32.png resize 32 32
```

## Product boundary

QPA is an **analytics-only** tool — **not financial advice**. Non-advisory disclaimer language must remain intact across the UI, print/report header, and documentation.

---

Built by Tuluntas09.
