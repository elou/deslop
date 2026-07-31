# Pangram Gallery

Pangram Gallery replaces feed posts that Pangram labels as AI with full-size public-domain artwork. It works by reading the verdict markers Pangram already adds to pages. It does not run its own AI detector.

## What v1 does

- Replaces `AI` posts by default.
- Can also replace `Mixed` posts.
- Uses public-domain works from The Met and Art Institute of Chicago.
- Keeps the original post behind a `Show original` button.
- Watches for new posts in infinite-scroll feeds.
- Stores preferences, but does not store downloaded artwork.

The extension is designed to work anywhere Pangram adds its feed badges. LinkedIn, Medium, and X are the first verification targets.

## Install from GitHub

1. Download the [latest release](https://github.com/elou/pangram-gallery/releases/latest) and unzip it.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select the unzipped `pangram-gallery` folder.
6. Keep the Pangram extension installed and signed in.

Open Pangram Gallery from Chrome's Extensions menu to choose verdicts and artwork sources.

Chrome will report that the extension can read and change data on websites. That broad permission is required because Pangram can label feeds on any site. Pangram Gallery looks only for Pangram's verdict markers and does not collect or transmit post text.

## Privacy and storage

Pangram Gallery reads verdict labels that Pangram injects into the current page. It sends no page or post text to its own server because it has no server. Artwork metadata comes directly from museum APIs, and images load from the museums' image services. Chrome sync stores only the extension settings.

## Source rights

The default providers expose explicit CC0 or public-domain records:

- [The Met Open Access](https://www.metmuseum.org/policies/frequently-asked-questions-image-and-data-resources)
- [Art Institute of Chicago image licensing](https://www.artic.edu/image-licensing)

New Yorker and Far Side cartoons are not included. Publicly viewable cartoons are still copyrighted, and neither publisher offers a public-domain feed for this use.

## Development

This is a dependency-free Manifest V3 extension.

- `npm test` checks verdict and provider behavior.
- `npm run check` validates the manifest and runs the test suite.
- Load the repository root as an unpacked extension for browser verification.

See [CHANGELOG.md](CHANGELOG.md) for the cumulative release history.

## License

Extension code is released under the MIT License. Museum artwork retains the rights status stated by its source record.
