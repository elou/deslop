# Pangram Gallery

## Goal

Build a GitHub-distributed Chrome extension that replaces feed posts Pangram labels as AI with quiet, full-size gallery interludes fetched from lawful public sources.

## Audience

A small group of Pangram users who install the unpacked extension from GitHub.

## v1

- Detect Pangram verdicts from the page contract Pangram already injects.
- Work across sites rather than tying verdict detection to LinkedIn.
- Verify feed behavior on LinkedIn, Medium, and X.
- Replace `AI` verdicts by default.
- Offer an option to include `Mixed` verdicts.
- Let people choose from supported content sources.
- Start with public-domain artwork from The Met and Art Institute of Chicago.
- Render a full-size gallery interlude with the artwork centered at 90% width.
- Reserve a stable 4:3 loading frame and metadata area before museum content arrives.
- Keep the original collapsed behind a `Show original` control.
- Observe new feed items as infinite-scroll pages append them.
- Fetch media at display time without persisting image bytes.
- Show restrained source information and link to the collection record.

## Experience

The interruption should feel quiet and gallery-like. It uses a white surface, generous vertical space, a full-width artwork with a natural cast shadow, and a clear path back to the original when Pangram produces a false positive.

## Constraints

- Chrome Manifest V3.
- No backend for v1.
- No scraping copyrighted cartoon archives.
- Only providers with an explicit public-domain or CC0 contract qualify for the default source list.
- Provider failures must not break or permanently hide the original feed item.
- Accessibility target: WCAG 2.2, keyboard access, visible focus, sufficient contrast, and reduced-motion support.

## Not v1

- Chrome Web Store publishing.
- New Yorker or Far Side cartoons without a license.
- A shared account system or hosted media cache.
- Reimplementing Pangram detection.

## Tracking

- Linear: [ELOU-962](https://linear.app/elou/issue/ELOU-962/build-pangram-gallery-chrome-extension-v1)
