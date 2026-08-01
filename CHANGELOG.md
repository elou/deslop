# Changelog

De-Slop follows semantic versioning from its first cumulative GitHub release.

## Unreleased

- Retired the Art 2, New Yorker, and Far Side streams and removed their active provider routing and dedicated host permissions.
- Added a machine-local Vocabulary feed: arbitrary selected text can be saved from Chrome's context menu, the stream appears only when enabled and nonempty, and stale empty-list routing falls back to Art.
- Added an optional native helper that resolves definitions through macOS Dictionary Services without a remote API or background model.
- Renamed the installed extension from Pangram Gallery to De-Slop and replaced its icon with 💩.
- Replaced the museum, PoetryDB, and APOD options with Painting Classics, Freeverse Classic Poetry, experimental Modern Art, and NASA Deep Space streams.
- Added live public-domain checks for Painting Classics and an author-balanced Freeverse poem source.
- Added a bounded WikiArt research stream and NASA Image and Video Library asset selection.
- Added Far Side (experimental) from the 354-row Hugging Face image dataset, with explicit copyrighted/noncommercial labeling because the dataset card has no license metadata.
- Added `❌ Hide AI completely`, which replaces selected verdicts with a compact `☢️ De-slopped your feed` notice.
- Added `💸 Hide promoted posts` for promoted impressions detected during initial scans and infinite scroll, with a compact `💸 De-monetized your feed` notice.
- Added `🦟 Hide suggested` for LinkedIn Suggested posts, with a compact `🤓 De-suggested your feed` notice.
- Added a normalized provider registry so category labels can pool sources without losing provider attribution.
- Added `🖼️ Art 2`, pooling National Gallery of Art and Rijksmuseum public-domain records; added explicit `🎾 Garross Gallery` research cards.
- Added `✨ Surprise me`, a rights-safe global pool across Art, Art 2, Poetry, and Deep Space.
- Added optional `AI-Assisted` verdict handling, including a third per-verdict stream mapping in Style each differently mode.
- Fixed AI-Assisted routing so its separate stream selection is honored.
- Added comment-only 🤡 treatment for Pangram-marked comments, preserving the parent post and accessible original comment text.
- Hardened promoted and Suggested cleanup to use only explicit, owned LinkedIn signals; profile Featured items remain visible and mutation handling no longer rescans the full feed.
- Fixed promoted and Suggested cleanup when Pangram marks an already-rendered feed item after Gallery's initial scan.
- Fixed infinite-scroll verdicts when Pangram hydrates an existing badge's text node after the post is mounted.
- Redesigned all Gallery card types with a rounded editorial shell, centered media stage, creator/date detail, linked original-post author, compact Unhide control, and right-aligned Pangram verdict.
- Restored the approved tuned typography and single-row original-post controls for artwork and poetry cards after the shared-footer regression.
- Locked replacement cards to the approved visual reference, with centered portrait and landscape artwork, compact footer spacing, and an 8px Show original offset.
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
