# Pangram Gallery Design System

## Character

Quiet, editorial, and gallery-like. The replacement should feel like a small pause in a feed, not a warning, punishment, or novelty widget.

## Type

- Use a native system sans serif for controls so the extension remains fast and self-contained.
- Use a restrained serif stack for artwork titles and poetry excerpts.
- Keep injected card copy compact but do not set body text below 16px in the settings surface.

## Color

- White replacement-card surface.
- Ink text instead of pure black.
- Neutral gray borders and hover states.
- One muted museum-red accent reserved for links, focus, and selected states.
- Do not use verdict colors in the replacement card. Pangram owns the verdict semantics.

## Geometry

- Cards use 8px outer radii and 1px neutral borders.
- Use a 4px and 8px spacing rhythm.
- Center artwork at 90% width inside a generously padded stage.
- Use the speaking-page soft lit-image shadow plus a 1px translucent image edge.
- Place `Show original` at the lower-right corner of the artwork.

## Motion

- Fade the card in once after content arrives.
- Reserve a 4:3 artwork frame of at least 280px and the metadata area before remote content arrives.
- Use a quiet neutral shimmer only while museum content is loading; keep the final artwork contained in the same frame.
- Use no looping or decorative animation.
- Respect `prefers-reduced-motion`.

## Accessibility

- Native buttons and inputs.
- Visible keyboard focus.
- Text labels for all controls.
- `Show original` must work without a pointer.
- Provider errors restore the original content automatically.
