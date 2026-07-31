# Provider registry source check — 2026-07-30

## Decision

The runtime now separates provider adapters from user-facing category labels. Each adapter returns the same normalized card shape; a category can select one provider or randomly select from a pool. The source provider, rights label, credit, and record URL remain part of the card so pooling does not erase attribution.

## Art 2

Art 2 pools two sources for Emily's test pass:

- **National Gallery of Art** — [Open Access](https://www.nga.gov/artworks/free-images-and-open-access) describes more than 60,000 free images and a CC0 data release. The adapter samples the public `published_images.csv` index with byte ranges, requires `openaccess=1`, and resolves the image through the NGA IIIF API. It does not download the full CSV or persist it.
- **Rijksmuseum** — [Search](https://data.rijksmuseum.nl/docs/search) is available without an API key. The adapter searches image-available paintings, resolves the object → visual → digital Linked Art records, requires a public-domain rights statement on the visual record, and requests a bounded IIIF rendition.

The category label is `🖼️ Art 2`; the card still says `National Gallery of Art` or `Rijksmuseum` and links to the collection record.

## Garross Gallery

[The Art of Roland-Garros](https://www.garros.gallery/) publishes poster records in JSON-LD with direct image URLs and per-poster links. The adapter uses those records at display time and labels cards `🎾 Garross Gallery` with `Copyrighted · research link-back`. It is an explicit research stream and is excluded from the rights-safe Surprise me pool.

## Surprise me

`✨ Surprise me` is a global draw over the rights-safe providers only: Painting Classics, National Gallery of Art, Rijksmuseum, Freeverse, and Deep Space. It intentionally excludes publisher feeds, New Yorker/Far Side datasets, Modern Art research content, and Garross Gallery until their source terms are handled separately.

## Live implementation notes

- National Gallery's public CSV supports HTTP Range responses, so the adapter requests small chunks rather than loading an 89 MB index into the extension.
- Rijksmuseum's resolved IIIF access point is transformed from `/full/max/` to `/full/960,/` to keep feed memory bounded.
- Garross poster files are loaded only when a user selects that explicit stream; they are never included in a default global draw.
