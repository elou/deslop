# Pangram Gallery

Pangram Gallery replaces feed posts that Pangram labels as AI with quiet art, poetry, space photography, or New Yorker feed cards. It works by reading the verdict markers Pangram already adds to pages. It does not run its own AI detector.

## What it does

- Replaces `AI` posts by default.
- Can also replace `Mixed` posts.
- Can optionally replace `AI-Assisted` posts as a third Pangram verdict category.
- Uses one content stream for every verdict by default.
- Can route `AI` and `Mixed` verdicts to different streams.
- Offers 🖼️ Art, 🖼️ Art 2, 📜 Poetry, 🎨 Modern Art (experimental), 🌌 Deep Space, 🗞️ Publisher feeds, 🃏 New Yorker cartoons, 🃏 Far Side (experimental), 🎾 Garross Gallery, and ✨ Surprise me.
- Can replace selected verdicts with a compact `☢️ Slop cleansed` notice instead of loading a source.
- Can hide promoted impressions with `💸 Hide promoted posts`.
- Can hide LinkedIn Suggested posts with `🦟 Hide suggested`.
- Turns Pangram-flagged comments into 🤡 per word without hiding their human-authored parent post.
- Keeps the original post behind a `Show original` button.
- Watches for new posts in infinite-scroll feeds.
- Stores preferences, but does not store downloaded content.

The extension is designed to work anywhere Pangram adds its feed badges. LinkedIn, Medium, and X are the first verification targets.

## Install from GitHub

1. Download the [latest release](https://github.com/elou/pangram-gallery/releases/latest) and unzip it.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select the unzipped `pangram-gallery` folder.
6. Keep the Pangram extension installed and signed in.

Open Pangram Gallery from Chrome's Extensions menu to choose verdicts and content streams. Select **Style each differently** to choose one stream for AI, Mixed, and AI-Assisted. Choose **❌ Hide AI completely** in any dropdown to remove matching posts and leave the cleansing notice. The separate **💸 Hide promoted posts** and **🦟 Hide suggested** filters replace matching LinkedIn feed items with compact notices.

Chrome will report that the extension can read and change data on websites. That broad permission is required because Pangram can label feeds on any site. Pangram Gallery looks only for Pangram's verdict markers and does not collect or transmit post text.

## Comments

When Pangram marks a comment as AI, Gallery keeps the post and comment thread in place. Only the comment text becomes one 🤡 per visible word; the original comment remains available to screen readers. This treatment applies only to Pangram's explicit comment boundary and does not affect a human-authored parent post.

## Privacy and storage

Pangram Gallery reads verdict labels that Pangram injects into the current page. It sends no page or post text to its own server because it has no server. Content comes directly from the selected provider, and Chrome sync stores only the extension settings.

## Content streams

- **🖼️ Art** — a recognizable canon from Wikidata's bot-maintained famous-paintings catalog, with live Wikimedia Commons image and public-domain checks.
- **🖼️ Art 2** — a pooled art category that randomly chooses between National Gallery of Art Open Data (CC0) and Rijksmuseum public-domain IIIF paintings; the selected provider remains in the card attribution.
- **📜 Poetry** — author-balanced poems from [Freeverse](https://thefreeverse.org/), a 1,009-poem public-domain collection with source provenance.
- **Modern Art (experimental)** — a curated modern-style slice of the [WikiArt research corpus](https://huggingface.co/datasets/huggan/wikiart). It is labeled noncommercial research because the dataset's rights vary.
- **Deep Space** — optimized nebula, supernova-remnant, galaxy, and deep-field images from the official [NASA Image and Video Library](https://images.nasa.gov/), rather than weather-focused APOD rotation.
- **🗞️ Publisher feeds** — headlines and thumbnails from [The New Yorker's official RSS feed](https://www.newyorker.com/about/feeds).
- **New Yorker cartoons** — noncommercial Caption Contest cartoons and winning captions from the [NextML dataset](https://nextml.github.io/caption-contest-data/), delivered through AI2's bounded research mirror.
- **Far Side (experimental)** — 354 Far Side comic images from the [Hugging Face dataset](https://huggingface.co/datasets/maderix/farsidecomics-blip-captions). The dataset card does not state a license; the underlying comics are copyrighted, so this stream is labeled experimental/noncommercial and is not part of the rights-cleared Art pool.
- **🎾 Garross Gallery** — Roland-Garros poster records from [The Art of Roland-Garros](https://www.garros.gallery/), with a direct link back to each poster. It is an explicit research stream, not part of the rights-safe pool.
- **✨ Surprise me** — a global random draw across the rights-safe Art, Art 2, Poetry, and Deep Space providers. Publisher, modern-art, Far Side, New Yorker cartoons, and Garross sources stay opt-in because their source terms are different.

The runtime uses a provider registry: every adapter returns the same normalized card shape (`kind`, title, creator, location, source URL, rights, credit, provider, and media/text payload). Category labels hide provider selection for normal use, while the provider name and original link remain visible for attribution.

National Gallery images are sourced from its open-access data release and served through IIIF. Rijksmuseum images are checked for public-domain rights in the resolved visual record before use. New Yorker content remains copyrighted. Latest items behave like an RSS reader: the extension fetches the publisher's official feed at display time, retains the source label, and links to the original. Caption Contest cartoons use NextML's explicitly noncommercial dataset. New Yorker covers are not included because the cover gallery does not expose a comparable official feed. Far Side uses the experimental Hugging Face dataset described above. Garross Gallery is link-back research content and is excluded from Surprise me.

## Development

This is a dependency-free Manifest V3 extension.

- `npm test` checks verdict and provider behavior.
- `npm run check` validates the manifest and runs the test suite.
- Load the repository root as an unpacked extension for browser verification.

See [CHANGELOG.md](CHANGELOG.md) for the cumulative release history.

## License

Extension code is released under the MIT License. Stream content retains the rights status stated by its source or publisher.
