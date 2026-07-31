# Public-domain replacement feed research

Issue name: Public-domain replacement feed research
Issue: n/a
Model: gpt-5.6-terra
Commit: not committed
Checks: Verified primary Met, Art Institute Chicago, Smithsonian, Library of Congress, Project Gutenberg, Openverse, The Cat API, New Yorker, and Far Side rights/API documentation; probed API CORS and exposed rate-limit headers on 2026-07-30.
Residuals: Provider limits can change; LoC and Met publish enforcement but no numeric quota.
Next: Build v1 around Met and Art Institute CC0 filters, preserving each item's title, creator, and source URL as optional on-screen credit.

## 2026-07-30 scope expansion: official live feeds

Emily expanded the product beyond public-domain-only media. Copyrighted publisher
content may now be shown when it comes from an official feed, is fetched at display
time, keeps a source label, and links back to the original.

- **PoetryDB**: `https://poetrydb.org/random/1` returns a random poem with title,
  author, and line breaks. The endpoint was successfully probed from the extension
  adapter.
- **NASA APOD**: `https://api.nasa.gov/planetary/apod` returns image records with
  date and creator credit. v0.2.0 uses `DEMO_KEY`, preserves third-party copyright
  notices, and links to the dated APOD page. NASA documents a `30/hour` and
  `50/day` per-IP limit for the demo key.
- **The New Yorker Latest**: the publisher exposes
  `https://www.newyorker.com/feed/latest/rss` with titles, links, creators, and
  `media:thumbnail` images.
- **The New Yorker Cartoons**: the official Humor feed at
  `https://www.newyorker.com/feed/humor/rss` currently includes cartoon entries
  and thumbnails. The extension treats this as publisher RSS, not public-domain
  content, and does not persist the media.
- **New Yorker covers**: no comparable official cover feed was found. The cover
  gallery remains excluded because scraping or reproducing it would exceed the
  official-feed model.

Sources: [The New Yorker RSS feeds](https://www.newyorker.com/about/feeds),
[NASA APIs](https://api.nasa.gov/), [NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/),
and [PoetryDB](https://github.com/thundercomb/poetrydb).

## Ranked v1 shortlist

### 1. The Metropolitan Museum of Art

- API: `https://collectionapi.metmuseum.org/public/collection/v1/`; no key. Select only `isPublicDomain: true`, a nonempty `primaryImageSmall` or `primaryImage`, and an object record with an image.
- Rights: Open Access records are CC0. Commercial and noncommercial reuse is allowed without permission or fee. Attribution is not required, but the Met asks for a credit line.
- Browser: confirmed `Access-Control-Allow-Origin: *`.
- Limits: no stated numerical quota. Terms allow the Met to restrict transactions or later require keys.
- Sources: [Open Access FAQ](https://www.metmuseum.org/policies/frequently-asked-questions-image-and-data-resources), [API terms](https://www.metmuseum.org/policies/terms-and-conditions).

### 2. Art Institute of Chicago

- API: `https://api.artic.edu/api/v1/artworks?is_public_domain=true&limit=...`; no key. Construct image URLs from `config.iiif_url` and `image_id`.
- Rights: images marked `CC0 Public Domain Designation` are unrestricted, including commercial use. Enforce `is_public_domain: true` at the record level.
- Metadata is CC0 except `description`, which is CC BY 4.0 and needs attribution if displayed.
- Browser: confirmed `Access-Control-Allow-Origin: *`.
- Limits: no published numerical quota found. Use backoff and low request volume.
- Sources: [API documentation](https://api.artic.edu/docs/), [image licensing](https://www.artic.edu/image-licensing).

### 3. Smithsonian Open Access

- API: `https://api.si.edu/openaccess/api/v1.0/`; registration and API key required.
- Rights: only accept records or media explicitly designated CC0.
- Browser: confirmed CORS `*`; the research probe returned an `X-RateLimit-Limit` header of 10. Treat headers as dynamic.
- Implementation note: a key in a public extension is recoverable. Use a user-supplied key or defer until a proxy exists.
- Source: [Open Access FAQ](https://www.si.edu/openaccess/faq).

### 4. Library of Congress Free to Use and Reuse

- API: `https://www.loc.gov/.../?fo=json`; no key. JSON metadata and IIIF services are available.
- Use a conservative whitelist of specific Free to Use and Reuse sets and verify each rights advisory.
- Availability is not itself a rights grant. Do not treat generic cartoon search results as public domain.
- Browser: confirmed CORS `*`; the API enforces an unspecified rate limit and deep-paging limit.
- Sources: [Free to Use and Reuse](https://www.loc.gov/free-to-use/), [copyright guidance](https://www.loc.gov/legal/understanding-copyright/), [API limits](https://www.loc.gov/apis/json-and-yaml/).

### 5. Project Gutenberg

- Official OPDS search: `https://www.gutenberg.org/ebooks/search.opds/`, plus RSS and catalog data.
- Use a shipped list of verified poetry ebook IDs and authors. Extract short passages client-side and display author, title, and source link.
- Works are free to use in the United States; rights may differ elsewhere and project or trademark terms still apply.
- OPDS exposes CORS `*`. Ebook text downloads did not expose CORS after redirects in the research probe, so use the extension service worker with explicit host permissions.
- Sources: [terms](https://www.gutenberg.org/policy/terms_of_use.html), [feeds](https://www.gutenberg.org/ebooks/offline_catalogs.html).

## Secondary options

- Rijksmuseum: strong public-domain collection, but current data-service routing is less extension-simple than the Met and Art Institute. [Data services](https://data.rijksmuseum.nl/about/).
- Openverse: discovery layer, not a rights authority. Filter strictly to `cc0,pdm` and preserve license and source metadata. Anonymous limits observed during research were 20 requests per minute and 200 requests per day. [API](https://api.openverse.org/).
- Wikimedia Commons: usable only after parsing structured rights metadata per file. Public availability does not imply public domain.
- The Cat API: useful licensed fallback, but not public-domain provenance. Treat it as licensed service content and review its branding, key, and account requirements. [Terms](https://thecatapi.com/terms).

## Cartoon findings

### New Yorker cartoons (superseded for official-feed display)

The public-domain-only recommendation was to exclude them. After the scope
expanded, the official Humor RSS feed became acceptable for feed-reader-style
display with attribution and original links. Do not scrape the cartoon archive or
cover gallery. [Licensing FAQ](https://store.newyorker.com/pages/faq).

### The Far Side

Exclude from v1. FarWorks owns or administers the rights, and no authorized public-domain API or feed was found. Do not scrape or hotlink. [Rights administrator](https://publishing.andrewsmcmeel.com/contact-us/), [official site announcement](https://www.andrewsmcmeel.com/back-to-the-far-side-online/).

## Implementation guardrails

- Fetch from the Manifest V3 service worker with narrow host permissions.
- Store metadata and candidate IDs only, not media bytes.
- Provider adapters return `assetUrl`, `title`, `creator`, `date`, `sourceUrl`, `rights`, `credit`, and `provider`.
- Reject missing or ambiguous rights.
- Add timeouts, exponential backoff for 429 and 5xx responses, a local fallback, and a per-provider kill switch.
