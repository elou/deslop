# De-Slop

De-Slop replaces feed posts that Pangram labels as AI with quiet art, poetry, or space photography. It works by reading the verdict markers Pangram already adds to pages. It does not run its own AI detector.

## What it does

- Replaces `AI` posts by default.
- Can also replace `Mixed` posts.
- Can optionally replace `AI-Assisted` posts as a third Pangram verdict category.
- Uses one content stream for every verdict by default.
- Can route `AI` and `Mixed` verdicts to different streams.
- Offers 🖼️ Art, 📜 Poetry, 🎨 Modern Art (experimental), 🌌 Deep Space, 🎾 Garross Gallery, and ✨ Surprise me.
- Can replace selected verdicts with a compact `☢️ De-slopped your feed` notice instead of loading a source.
- Can hide promoted impressions with `💸 Hide promoted posts`.
- Can hide LinkedIn Suggested posts with `🦟 Hide suggested`.
- Turns Pangram-flagged comments into 🤡 per word without hiding their human-authored parent post.
- Keeps the original post behind a `Show original` button.
- Watches for new posts in infinite-scroll feeds.
- Stores preferences, but does not store downloaded provider content.

The extension is designed to work anywhere Pangram adds its feed badges. LinkedIn, Medium, and X are the first verification targets.

## Install from GitHub

1. Download the [latest release](https://github.com/elou/deslop/releases/latest) and unzip it.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select the unzipped `deslop` folder.
6. Keep the Pangram extension installed and signed in.

Open De-Slop from Chrome's Extensions menu to choose verdicts and content streams. Select **Style each differently** to choose one stream for AI, Mixed, and AI-Assisted. Choose **❌ Hide AI completely** in any dropdown to remove matching posts and leave a De-slopped notice. The separate **💸 Hide promoted posts** and **🦟 Hide suggested** filters can either render a chosen stream or leave compact cleanup notices.

Chrome will report that the extension can read and change data on websites. That broad permission is required because Pangram can label feeds on any site. De-Slop looks only for Pangram's verdict markers and does not collect or transmit post text.

## Comments

When Pangram marks a comment as AI, Gallery keeps the post and comment thread in place. Only the comment text becomes one 🤡 per visible word; the original comment remains available to screen readers. This treatment applies only to Pangram's explicit comment boundary and does not affect a human-authored parent post.

## Privacy and storage

De-Slop reads verdict labels that Pangram injects into the current page. It sends no page or post text to its own server because it has no server. Content comes directly from the selected provider, and Chrome Sync stores only extension settings.

## Content streams

- **🖼️ Art** — a recognizable canon from Wikidata's bot-maintained famous-paintings catalog, with live Wikimedia Commons image and public-domain checks.
- **📜 Poetry** — author-balanced poems from [Freeverse](https://thefreeverse.org/), a 1,009-poem public-domain collection with source provenance.
- **Modern Art (experimental)** — a curated modern-style slice of the [WikiArt research corpus](https://huggingface.co/datasets/huggan/wikiart). It is labeled noncommercial research because the dataset's rights vary.
- **Deep Space** — optimized nebula, supernova-remnant, galaxy, and deep-field images from the official [NASA Image and Video Library](https://images.nasa.gov/), rather than weather-focused APOD rotation.
- **🎾 Garross Gallery** — Roland-Garros poster records from [The Art of Roland-Garros](https://www.garros.gallery/), with a direct link back to each poster. It is an explicit research stream, not part of the rights-safe pool.
- **✨ Surprise me** — a global random draw across the rights-safe Art, Poetry, and Deep Space providers. Modern-art and Garross stay opt-in because their source behavior is different.

The runtime uses a provider registry: every adapter returns the same normalized card shape (`kind`, title, creator, location, source URL, rights, credit, provider, and media/text payload). Category labels hide provider selection for normal use, while the provider name and original link remain visible for attribution.

Garross Gallery is link-back research content and is excluded from Surprise me.

## Development

This is a dependency-free Manifest V3 extension.

The repository retains an unfinished local-vocabulary implementation behind `FEATURE_ENABLED = false`. The current release exposes no vocabulary controls, context menu, feed route, or native-messaging permission. Existing stale Vocabulary routes repair to Art.

- `npm test` checks verdict and provider behavior.
- `npm run check` validates the manifest and runs the test suite.
- Load the repository root as an unpacked extension for browser verification.

See [CHANGELOG.md](CHANGELOG.md) for the cumulative release history.

## License

Extension code is released under the MIT License. Stream content retains the rights status stated by its source or publisher.
