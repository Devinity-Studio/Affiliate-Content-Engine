# ACE Remotion integration scaffold

Remotion is not active in the current MVP runtime yet. This directory reserves
the deterministic Thai typography boundary for the future Content Editor.

## Policy

- Windows-installed fonts may be used for local preview only.
- Final Render must load a licensed font file from `public/fonts/`.
- Text must be rendered as a Remotion/React text layer, not baked into an AI image.
- Thai typography must be checked in both Studio preview and rendered MP4.
- Animate words or text groups first; avoid per-glyph animation until Thai shaping
  has been tested for the selected font.

## Planned wiring

```text
Content Editor → Thai Text QA → fonts.css → Remotion Composition → Finalize
```

Before enabling production rendering, add the licensed `.woff2` files described
in `public/fonts/README.md` and create a Thai typography acceptance test using
real product names, prices, percentages, dates, and Thai punctuation.
