# Canonical art and poetry sources

Research date: 2026-07-30

## Goal

Replace the obscure tail of random museum and PoetryDB results with
recognizable paintings and classic poems while keeping Pangram Gallery
backend-free and lightweight.

## Paintings

### Recommended default: Wikidata + Wikimedia Commons canon

- Wikidata's `WikiProject sum of all paintings` provides structured records
  across many museums rather than one institution.
- Rank paintings by the number of Wikimedia sitelinks as a practical
  recognition signal. A live query returned, in order, *Mona Lisa*, *The Starry
  Night*, *Girl with a Pearl Earring*, *Guernica*, *Liberty Leading the
  People*, *The Night Watch*, *The Birth of Venus*, *Las Meninas*,
  *Impression, Sunrise*, and *The Kiss*.
- Generate a compact list of the top several hundred or thousand Wikidata IDs
  at release time. This avoids making the extension wait on the public SPARQL
  service.
- At display time, call the Wikimedia Commons `imageinfo` API for a 960-pixel
  thumbnail, artist, credit, source page, and license. No image bytes are
  stored by the extension.
- A live *Starry Night* probe returned a 960 × 760 public-domain JPEG at
  350,032 bytes with CORS enabled.
- Wikimedia Commons file licenses must still be checked per item. Works without
  a usable freely licensed image should be omitted.

Sources:

- https://www.wikidata.org/wiki/Wikidata:WikiProject_sum_of_all_paintings
- https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service
- https://developer.wikimedia.org/use-content/content/
- https://commons.wikimedia.org/wiki/Category:Featured_pictures_of_paintings

### Optional modern stream: WikiArt research corpus

- The common Hugging Face mirror has 81,444 images across 129 artists, 27
  styles, and 11 genres, including Cubism, Expressionism, Abstract
  Expressionism, Pop Art, and Minimalism.
- Its stated use is noncommercial research and it inherits WikiArt's terms.
- This supplies twentieth-century work that a public-domain-only stream cannot,
  but it is a separate rights posture and should be labeled accordingly.
- The common corpus has weak artwork-level metadata, so cards may have artist
  and style without a reliable title or collection.

Sources:

- https://huggingface.co/datasets/ksenijasam/wikiart
- https://www.wikiart.org/en/terms-of-use

### Other datasets considered

- MoMA's GitHub dataset has more than 160,000 artwork records, but images are
  not included and its external API is currently limited to staff and
  partners. It cannot directly power the cards.
- *Best Artworks of All Time* contains roughly 8,400 images from 50 influential
  artists under CC BY-NC-SA 4.0, but it lacks artwork titles, dates, and
  collection metadata and was scraped from another site.
- National Gallery of Art Open Data is well structured and CC0, but random
  sampling would recreate the same long-tail relevance problem as the current
  museum adapters.

Sources:

- https://api.moma.org/
- https://github.com/MuseumofModernArt/collection
- https://www.kaggle.com/datasets/ikarus777/best-artworks-of-all-time
- https://github.com/NationalGalleryOfArt/opendata

## Poetry

### Recommended default: Freeverse

- The public GitHub repository currently contains 1,009 poem text files and
  matching per-poem metadata.
- The live reader exposes 1,009 public-domain poems through a CORS-enabled
  search index at `https://thefreeverse.org/api/search-index.json`.
- Poems use stable line breaks. Each metadata record names Project Gutenberg or
  Wikisource as the canonical source and records a US public-domain rationale.
- The extension can fetch the compact index, choose a poem, and fetch the
  individual raw text file from GitHub. It does not need to store the corpus.
- This is a better default than PoetryDB's unweighted random endpoint because
  the source is intentionally curated for reading.

Sources:

- https://thefreeverse.org/
- https://github.com/Spitfire-Cowboy/freeverse
- https://raw.githubusercontent.com/Spitfire-Cowboy/freeverse/main/PROVENANCE.md

### Alternative anthology: Oxford Book of English Verse

- Project Gutenberg ebook 66619 is the influential 1900 anthology *The Oxford
  Book of English Verse, 1250–1900*.
- It contains 883 numbered selections and is public domain in the United
  States.
- It is a strong canonical list but a weaker live source: the poems are packed
  into one large HTML document, so the extension would need a generated index
  or repeated parsing of the full book.

Source:

- https://www.gutenberg.org/ebooks/66619

## Product recommendation

1. Replace the current default Art behavior with **Painting Classics**:
   a release-generated Wikidata canon plus live Wikimedia Commons thumbnails.
2. Keep the existing Met/Art Institute path as **Museum Surprise** for people
   who want discovery.
3. Replace PoetryDB as the default poetry source with **Classic Poetry** from
   Freeverse.
4. Keep PoetryDB as **Poetry Surprise**.
5. Consider **Modern Art (noncommercial)** as a separately labeled option
   after a visual and rights review of the WikiArt corpus.
