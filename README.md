# De-Slop

De-Slop replaces feed posts that Pangram labels as AI with quiet art, poetry, space photography, or words from a vocabulary list you build while browsing. It works by reading the verdict markers Pangram already adds to pages. It does not run its own AI detector.

## What it does

- Replaces `AI` posts by default.
- Can also replace `Mixed` posts.
- Can optionally replace `AI-Assisted` posts as a third Pangram verdict category.
- Uses one content stream for every verdict by default.
- Can route `AI` and `Mixed` verdicts to different streams.
- Offers 🖼️ Art, 📜 Poetry, 🎨 Modern Art (experimental), 🌌 Deep Space, 🎾 Garross Gallery, ✨ Surprise me, and an opt-in local Vocabulary feed.
- Saves arbitrary selected text from Chrome's right-click menu without validating, splitting, or deduplicating it.
- Can replace selected verdicts with a compact `☢️ De-slopped your feed` notice instead of loading a source.
- Can hide promoted impressions with `💸 Hide promoted posts`.
- Can hide LinkedIn Suggested posts with `🦟 Hide suggested`.
- Turns Pangram-flagged comments into 🤡 per word without hiding their human-authored parent post.
- Keeps the original post behind a `Show original` button.
- Watches for new posts in infinite-scroll feeds.
- Stores preferences and vocabulary entries, but does not store downloaded provider content.

The extension is designed to work anywhere Pangram adds its feed badges. LinkedIn, Medium, and X are the first verification targets.

## Install from GitHub

1. Download the [latest release](https://github.com/elou/pangram-gallery/releases/latest) and unzip it.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select the unzipped `pangram-gallery` folder.
6. Keep the Pangram extension installed and signed in.

Open De-Slop from Chrome's Extensions menu to choose verdicts and content streams. Select **Style each differently** to choose one stream for AI, Mixed, and AI-Assisted. Choose **❌ Hide AI completely** in any dropdown to remove matching posts and leave a De-slopped notice. The separate **💸 Hide promoted posts** and **🦟 Hide suggested** filters can either render a chosen stream or leave compact cleanup notices.

Chrome will report that the extension can read and change data on websites. That broad permission is required because Pangram can label feeds on any site. De-Slop looks only for Pangram's verdict markers and does not collect or transmit post text.

## Vocabulary feed

1. Select any text on a page and right-click it.
2. Choose **Add “…” to De-Slop vocabulary**. De-Slop saves the exact selection after trimming only its outside whitespace; multi-word selections and duplicates are allowed.
3. Open De-Slop and turn on **Use saved vocabulary** at the bottom of the popup.
4. Once the feature is on and at least one entry exists, **📚 Vocabulary** appears in the replacement dropdowns.

An enabled but empty list is never offered as a replacement stream. If Vocabulary is selected and the list later becomes disabled or empty, De-Slop repairs that routing choice to **🖼️ Art** rather than leaving a blank replacement.

Vocabulary entries live in `chrome.storage.local`, not Chrome Sync. The extension saves the term before attempting a definition, so a definition failure cannot lose the entry.

### Local macOS definitions

Definitions come from the dictionaries already active in macOS. Chrome requires a small native-messaging helper to call that system API:

1. Open `chrome://extensions`, find De-Slop, and copy its extension ID.
2. From the repository root, run `./scripts/install-dictionary-host.sh <extension-id>`.
3. Reload De-Slop from `chrome://extensions`.

The helper is compiled locally from `native/dictionary-host/main.swift`. It receives only the saved term, calls macOS Dictionary Services, and returns plain text to the extension; it makes no network request. Without the helper, saving and using vocabulary still works, but the card shows **Definition unavailable**.

## Comments

When Pangram marks a comment as AI, Gallery keeps the post and comment thread in place. Only the comment text becomes one 🤡 per visible word; the original comment remains available to screen readers. This treatment applies only to Pangram's explicit comment boundary and does not affect a human-authored parent post.

## Privacy and storage

De-Slop reads verdict labels that Pangram injects into the current page. It sends no page or post text to its own server because it has no server. Content comes directly from the selected provider, Chrome Sync stores only extension settings, and vocabulary entries stay in local extension storage. System definition lookup stays on the Mac through the optional native helper.

## Content streams

- **🖼️ Art** — a recognizable canon from Wikidata's bot-maintained famous-paintings catalog, with live Wikimedia Commons image and public-domain checks.
- **📜 Poetry** — author-balanced poems from [Freeverse](https://thefreeverse.org/), a 1,009-poem public-domain collection with source provenance.
- **Modern Art (experimental)** — a curated modern-style slice of the [WikiArt research corpus](https://huggingface.co/datasets/huggan/wikiart). It is labeled noncommercial research because the dataset's rights vary.
- **Deep Space** — optimized nebula, supernova-remnant, galaxy, and deep-field images from the official [NASA Image and Video Library](https://images.nasa.gov/), rather than weather-focused APOD rotation.
- **🎾 Garross Gallery** — Roland-Garros poster records from [The Art of Roland-Garros](https://www.garros.gallery/), with a direct link back to each poster. It is an explicit research stream, not part of the rights-safe pool.
- **✨ Surprise me** — a global random draw across the rights-safe Art, Poetry, and Deep Space providers. Modern-art, Garross, and local Vocabulary sources stay opt-in because their source behavior is different.
- **📚 Vocabulary** — a random saved entry plus its locally cached system definition when available. This stream appears only after it is enabled and has content.

The runtime uses a provider registry: every adapter returns the same normalized card shape (`kind`, title, creator, location, source URL, rights, credit, provider, and media/text payload). Category labels hide provider selection for normal use, while the provider name and original link remain visible for attribution.

Garross Gallery is link-back research content and is excluded from Surprise me. Vocabulary does not join Surprise me and never sends saved text to a content provider.

## Development

This is a dependency-free Manifest V3 extension.

- `npm test` checks verdict and provider behavior.
- `npm run check` validates the manifest and runs the test suite.
- Load the repository root as an unpacked extension for browser verification.

See [CHANGELOG.md](CHANGELOG.md) for the cumulative release history.

## License

Extension code is released under the MIT License. Stream content retains the rights status stated by its source or publisher.
