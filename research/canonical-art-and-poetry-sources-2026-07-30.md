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
- Use the project's bot-maintained **The Most Famous Paintings of the World**
  catalog (`Q41634361`) rather than inventing a ranking from sitelinks. It
  contains 101 numbered works and can be retrieved with a small, fast catalog
  query.
- A live audit found 84 catalog entries with a Commons image and 79 with a
  960-pixel rendition explicitly marked `Public domain` and
  `Copyrighted: False`. The usable tail includes Seurat, Munch, Kandinsky,
  Klee, and *American Gothic*, so the stream reaches early modernism without
  using a single museum's obscure long tail.
- Keep the resulting 79 Wikidata IDs as a compact release-generated catalog.
  This is routing metadata, not stored media, and avoids making every card wait
  on the public SPARQL service.
- At display time, call the Wikimedia Commons `imageinfo` API for a 960-pixel
  thumbnail, artist, credit, source page, and license. No image bytes are
  stored by the extension.
- Live probes returned properly scaled, CORS-enabled public-domain images for
  *Mona Lisa*, *The Starry Night*, *Girl with a Pearl Earring*, *Liberty
  Leading the People*, *The Night Watch*, *The Birth of Venus*, *Las Meninas*,
  *Impression, Sunrise*, and *The Kiss*.
- Wikimedia Commons file licenses must still be checked per item. Works without
  a usable public-domain image should be omitted. This matters: the catalog's
  `Guernica` image was a CC BY-SA photograph of a mural reproduction rather
  than the original painting.

Sources:

- https://www.wikidata.org/wiki/Wikidata:WikiProject_sum_of_all_paintings
- https://www.wikidata.org/wiki/Wikidata:WikiProject_sum_of_all_paintings/Catalog/The_Most_Famous_Paintings_of_the_World
- https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service
- https://developer.wikimedia.org/use-content/content/
- https://www.mediawiki.org/wiki/API:Imageinfo
- https://commons.wikimedia.org/wiki/Category:Featured_pictures_of_paintings

### Optional modern stream: WikiArt research corpus

- The common Hugging Face mirror has 81,444 images across 129 artists, 27
  styles, and 11 genres, including Cubism, Expressionism, Abstract
  Expressionism, Pop Art, and Minimalism.
- The full `ksenijasam/wikiart` mirror is not suitable for a live extension
  today: its row endpoint fails because each Parquet row group exceeds the
  dataset server's 300 MB scan limit.
- The `huggan/wikiart` mirror currently exposes a working 11,320-row partial
  viewer. Its row endpoint returns signed image URLs and 1,382–1,908px samples
  in the tested modern-art rows. Six downloaded samples ranged from 289–589 KB.
- Its stated use is noncommercial research and it inherits WikiArt's terms.
  WikiArt says it presents both public-domain and copyright-protected works,
  with protected works shown as low-resolution copies for informational and
  educational use. The Hugging Face dataset license remains `unknown`.
- This supplies twentieth-century work that a public-domain-only stream cannot,
  but it is a separate rights posture and should be labeled accordingly.
- The corpus has weak artwork-level metadata: a card can show artist, genre,
  and style, but not a reliable artwork title, date, collection, or original
  source page. A visual sample was attractive, but classifications were
  sometimes implausible and the absence of titles makes it less gallery-like.
- Recommendation: keep this as an explicitly experimental,
  **Modern Art (noncommercial research)** option. Use the working 11,320-row
  mirror, link to the dataset, and do not present its class labels as
  authoritative scholarship.

Sources:

- https://huggingface.co/datasets/ksenijasam/wikiart
- https://huggingface.co/datasets/huggan/wikiart
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
- The current index spans 43 author labels. It includes *Because I could not
  stop for Death*, *The Raven*, *Ozymandias*, Shakespeare's Sonnet 18,
  *I Wandered Lonely as a Cloud*, and *Annabel Lee*.
- Poems use stable line breaks. Each metadata record names Project Gutenberg or
  Wikisource as the canonical source and records a US public-domain rationale.
- The extension can fetch the compact index, choose a poem, and fetch the
  individual raw text file from GitHub. It does not need to store the corpus.
- This is a better default than PoetryDB's unweighted random endpoint because
  the source is intentionally curated for reading.
- Uniform random selection is still not a good “classic” algorithm: 154 entries
  are Shakespeare, 123 are José-Maria de Heredia, and 76 are Gustavo Adolfo
  Bécquer. Use author-balanced selection or a compact release-generated list of
  featured/canonical poem IDs, then fetch the selected text live.
- The search index is about 217 KB, has `Access-Control-Allow-Origin: *`, and a
  sampled raw poem was 527 bytes. The reader URL is derived directly from the
  poem ID, so every card can link to the full line-stable poem.

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

1. Add **Painting Classics** from the 79 clean public-domain entries in
   Wikidata's 101-work famous-paintings catalog, with live Wikimedia Commons
   thumbnails and a live rights check.
2. Ship **Classic Poetry** from Freeverse, using author-balanced or
   featured-list selection rather than uniform random over all 1,009 poems.
3. Offer **Modern Art (noncommercial research)** only as an experimental
   option. The usable mirror and visual quality are adequate, but the license
   posture and missing artwork metadata are materially weaker than the other
   streams.
4. Pair the lineup with **Deep Space** from NASA's Image and Video Library;
   keep New Yorker Latest and New Yorker Cartoons as the publisher and
   noncommercial research streams already in the extension.
