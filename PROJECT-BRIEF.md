# De-Slop

## Goal

Build a GitHub-distributed Chrome extension that replaces feed posts Pangram labels as AI with quiet art, poetry, space, or locally saved vocabulary interludes.

The project is personal and noncommercial. Its purpose is to make the volume of
AI-written posts in a feed visible through the accumulated replacement
interludes, not to create a commercial cartoon-reading product.

## Audience

A small group of Pangram users who install the unpacked extension from GitHub.

## v1

- Detect Pangram verdicts from the page contract Pangram already injects.
- Work across sites rather than tying verdict detection to LinkedIn.
- Verify feed behavior on LinkedIn, Medium, and X.
- Replace `AI` verdicts by default.
- Offer an option to include `Mixed` verdicts.
- Offer an option to include `AI-Assisted` verdicts as a third Pangram category.
- Let people choose from supported content streams.
- Hide provider selection behind category labels while preserving provider/source attribution in every card.
- Keep Garross Gallery as an explicit research stream.
- Offer Surprise me as a global random draw across rights-safe art, poetry, and space providers.
- Let people use one stream for all selected verdicts or route AI, Mixed, and AI-Assisted differently.
- Let people choose `❌ Hide AI completely` for either verdict mapping, removing the post and leaving a compact `☢️ De-slopped your feed` notice.
- Let people separately enable `💸 Hide promoted posts` to replace promoted impressions with a compact `💸 De-monetized your feed` notice or a selected stream.
- Let people separately enable `🦟 Hide suggested` to replace LinkedIn Suggested posts with a compact `🤓 De-suggested your feed` notice or a selected stream.
- When Pangram marks a comment as AI, leave the parent post untouched and render only that comment as a clown emoji per word, while retaining the original text for assistive technology.
- Start with a recognizable public-domain Painting Classics canon sourced through Wikidata and Wikimedia Commons.
- Include a Classic Poetry stream from Freeverse, an experimental Modern Art stream from WikiArt's research corpus, and a Deep Space stream from NASA's Image and Video Library.
- Include Garross Gallery as a separately labeled, copyrighted research/link-back stream; do not include it in Surprise me.
- Let people save arbitrary selected text from Chrome's right-click menu to a machine-local vocabulary list without validating or splitting it.
- Offer Vocabulary as a stream only when it is enabled and nonempty; repair stale routing choices to Art.
- Use an optional local macOS Dictionary helper for definitions without sending terms to a remote service.
- Render a full-size gallery interlude with the artwork centered at 90% width.
- Reserve a stable 4:3 loading frame and metadata area before remote source content arrives.
- Keep the original collapsed behind a `Show original` control.
- Observe new feed items as infinite-scroll pages append them.
- Fetch media at display time without persisting image bytes.
- Show restrained source information and link to the collection record.

## Experience

The interruption should feel quiet and gallery-like. It uses a white surface, generous vertical space, a full-width artwork with a natural cast shadow, and a clear path back to the original when Pangram produces a false positive.

## Constraints

- Chrome Manifest V3.
- No backend for v1.
- Noncommercial research datasets may qualify when their stated terms permit
  this use. Dataset access terms and the copyright status of underlying media
  must be evaluated separately.
- Provider failures must not break or permanently hide the original feed item.
- Accessibility target: WCAG 2.2, keyboard access, visible focus, sufficient contrast, and reduced-motion support.

## Not v1

- Chrome Web Store publishing.
- Vocabulary list management and learned/unlearned state.
- A shared account system or hosted media cache.
- Reimplementing Pangram detection.

## Tracking

- Linear: [ELOU-962](https://linear.app/elou/issue/ELOU-962/build-pangram-gallery-chrome-extension-v1)
