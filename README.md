# Pangram Gallery

Pangram Gallery replaces feed posts that Pangram labels as AI with quiet art, poetry, space photography, or New Yorker feed cards. It works by reading the verdict markers Pangram already adds to pages. It does not run its own AI detector.

## What it does

- Replaces `AI` posts by default.
- Can also replace `Mixed` posts.
- Uses one content stream for every verdict by default.
- Can route `AI` and `Mixed` verdicts to different streams.
- Offers Painting Classics, Classic Poetry, Modern Art (experimental), Deep Space, New Yorker Latest, and New Yorker Cartoons.
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

Open Pangram Gallery from Chrome's Extensions menu to choose verdicts and content streams. Select **Style each differently** to choose one stream for AI and another for Mixed.

Chrome will report that the extension can read and change data on websites. That broad permission is required because Pangram can label feeds on any site. Pangram Gallery looks only for Pangram's verdict markers and does not collect or transmit post text.

## Privacy and storage

Pangram Gallery reads verdict labels that Pangram injects into the current page. It sends no page or post text to its own server because it has no server. Content comes directly from the selected provider, and Chrome sync stores only the extension settings.

## Content streams

- **Painting Classics** — a recognizable canon from Wikidata's bot-maintained famous-paintings catalog, with live Wikimedia Commons image and public-domain checks.
- **Classic Poetry** — author-balanced poems from [Freeverse](https://thefreeverse.org/), a 1,009-poem public-domain collection with source provenance.
- **Modern Art (experimental)** — a curated modern-style slice of the [WikiArt research corpus](https://huggingface.co/datasets/huggan/wikiart). It is labeled noncommercial research because the dataset's rights vary.
- **Deep Space** — optimized nebula, supernova-remnant, galaxy, and deep-field images from the official [NASA Image and Video Library](https://images.nasa.gov/), rather than weather-focused APOD rotation.
- **New Yorker latest** — headlines and thumbnails from [The New Yorker's official RSS feed](https://www.newyorker.com/about/feeds).
- **New Yorker cartoons** — noncommercial Caption Contest cartoons and winning captions from the [NextML dataset](https://nextml.github.io/caption-contest-data/), delivered through AI2's bounded research mirror.

New Yorker content remains copyrighted. Latest items behave like an RSS reader: the extension fetches the publisher's official feed at display time, retains the source label, and links to the original. Caption Contest cartoons use NextML's explicitly noncommercial dataset. New Yorker covers are not included because the cover gallery does not expose a comparable official feed. Far Side cartoons are not included.

## Development

This is a dependency-free Manifest V3 extension.

- `npm test` checks verdict and provider behavior.
- `npm run check` validates the manifest and runs the test suite.
- Load the repository root as an unpacked extension for browser verification.

See [CHANGELOG.md](CHANGELOG.md) for the cumulative release history.

## License

Extension code is released under the MIT License. Stream content retains the rights status stated by its source or publisher.
