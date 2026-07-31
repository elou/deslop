# Changelog

Pangram Gallery follows semantic versioning from its first cumulative GitHub release.

## Unreleased

- Replaced the museum, PoetryDB, and APOD options with Painting Classics, Freeverse Classic Poetry, experimental Modern Art, and NASA Deep Space streams.
- Added live public-domain checks for Painting Classics and an author-balanced Freeverse poem source.
- Added a bounded WikiArt research stream and NASA Image and Video Library asset selection.
- Added Far Side (experimental) from the 354-row Hugging Face image dataset, with explicit copyrighted/noncommercial labeling because the dataset card has no license metadata.
- Added `❌ Hide AI completely`, which replaces selected verdicts with a compact `☢️ Slop cleansed` notice.
- Added `💸 Hide promoted posts` for promoted impressions detected during initial scans and infinite scroll, with a compact `💸 Unpromoted a post` notice.
- Added `🦟 Hide suggested` for LinkedIn Suggested posts, with a compact `🦟 Un-suggested a post` notice.
- Added a normalized provider registry so category labels can pool sources without losing provider attribution.
- Added `🖼️ Art 2`, pooling National Gallery of Art and Rijksmuseum public-domain records; added explicit `🎾 Garross Gallery` research cards.
- Added `✨ Surprise me`, a rights-safe global pool across Art, Art 2, Poetry, and Deep Space.
- Added optional `AI-Assisted` verdict handling, including a third per-verdict stream mapping in Style each differently mode.
- Fixed AI-Assisted routing so its separate stream selection is honored.
- Added comment-only 🤡 treatment for Pangram-marked comments, preserving the parent post and accessible original comment text.
- Hardened promoted and Suggested cleanup to use only explicit, owned LinkedIn signals; profile Featured items remain visible and mutation handling no longer rescans the full feed.
- Delayed offscreen cards now defer image loading until they are near the viewport.

## 0.2.0 — 2026-07-30

- Added Painting Classics, Classic Poetry, Modern Art (experimental), Deep Space, New Yorker Latest, and NextML Caption Contest cartoon streams.
- Added a compact same-versus-different mode for routing AI and Mixed verdicts.
- Added stable poetry cards with preserved line breaks and source attribution.
- Capped New Yorker feed images at 960px and skipped animated GIF thumbnails to limit feed memory use.
- Used AI2's 600px research mirror for NextML cartoons instead of NextML's multi-megabyte originals.
- Continued to fetch content directly from provider APIs and RSS without a media store.

## 0.1.4 — 2026-07-30

- Constrained portrait and landscape artwork to the reserved 4:3 frame.
- Preserved uncropped artwork, natural proportions, and the lit-image shadow.

## 0.1.3 — 2026-07-30

- Added a quiet loading state with a stable 4:3 artwork frame and reserved metadata area.
- Hydrated replacement cards in place to reduce feed movement.
- Made `Show original` swap the gallery card for the original post in place.

## 0.1.2 — 2026-07-30

- Redesigned replacements as full-size white gallery interludes.
- Centered artwork at 90% width and added the portfolio-style image shadow.
- Replaced creator/date copy with the artwork's location.
- Hid the complete original feed item, including comments and actions.

## 0.1.1 — 2026-07-30

- Bounded mutation processing to newly added feed subtrees.
- Removed orphaned cards and released image references.
- Unloaded remote images away from the viewport to reduce memory use.

## 0.1.0 — 2026-07-30

- Added site-agnostic Pangram badge detection for infinite-scroll feeds.
- Replaced AI-labeled posts by default, with an option to include Mixed.
- Added the initial source controls, Chrome sync settings, and unpacked installation instructions.
