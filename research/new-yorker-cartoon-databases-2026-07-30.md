# New Yorker cartoon databases

Research date: 2026-07-30

## Finding

Several substantial databases exist. NextML is the best fit for Pangram
Gallery's personal, noncommercial Caption Contest stream; none of the sources
provides a comparable broad archive with a general reuse grant.

## Sources

### Cartoon Bank

- URL: https://cartoonbank.com/
- Official, searchable licensing database.
- Search fields include collection, category, artist, date, orientation, and
  rights-managed versus royalty-free licensing.
- The Cartoon Bank has described its inventory as more than 100,000 cartoons,
  with more than 20,000 available through the searchable site.
- Best source for discovery and licensed reuse.
- No public API was found.

### NextML Caption Contest dataset

- Browser: https://nextml.github.io/caption-contest-data/
- GitHub: https://github.com/nextml/caption-contest-data
- Contains Caption Contest cartoon images, submitted captions, winners, and
  very large voting datasets. The current browser lists contests through the
  high 800s.
- The GitHub repository contains `cartoons`, `dashboards`, winner data, and
  scripts.
- The dataset page states that the data may not be used commercially.
- Useful for research and browsing Caption Contest cartoons, but not a general
  archive of every published New Yorker cartoon.

### AI2 / Hessel Caption Contest corpus

- GitHub: https://github.com/jmhessel/caption_contest_corpus
- Hugging Face: https://huggingface.co/datasets/jmhessel/newyorker_caption_contest
- Contains images, captions, contest numbers, scene descriptions, explanations,
  entity links, and model-evaluation tasks.
- Hugging Face reports 148,945 rows and 7.91 GB.
- The repository provides a direct download for all contest images.
- The researchers license their annotations and task framing under CC BY 4.0.
  That license does not turn the underlying New Yorker cartoon images into
  CC-licensed material.

### Internet Archive: Complete Cartoons CD-ROM

- URL: https://archive.org/details/Complete-New-Yorker-Cartoons-2004
- A user-uploaded copy of the two CD-ROMs distributed with *The Complete
  Cartoons of the New Yorker*.
- The item says it contains all 68,647 cartoons published through 2004.
- Available as two ISO images totaling about 1.3 GB.
- This is a software/database archive, not a simple web image API.
- The item shows no reuse license and was uploaded by an individual, not by The
  New Yorker. Treat it as research/reference material, not an extension source.

### New Yorker Digital Archive

- Official archive: https://archives.newyorker.com/
- Library access example:
  https://www.nypl.org/collections/articles-databases/new-yorker
- Provides full-color issues from 1925 onward through subscription or library
  access.
- Useful for historical lookup, but no public cartoon API or feed was found.

## Product conclusion

- Use NextML Caption Contest data for the extension's New Yorker Cartoons
  stream. Fetch one randomized row at display time through the AI2/Hugging Face
  research mirror, whose image rendition is bounded to 600 pixels.
- Continue using The New Yorker's official RSS feed for New Yorker Latest.
- Emily clarified that Pangram Gallery is a personal, noncommercial commentary
  tool intended to demonstrate the volume of AI-written posts in feeds.
- NextML's explicit noncommercial restriction is compatible with that purpose.
- Internet Archive's terms do not provide a content license. Its rights guidance
  places responsibility on the user to ensure use is non-infringing, and the
  CD-ROM item has no declared license. A fair-use argument may be available for
  criticism or comment, but noncommercial purpose alone does not settle the
  four-factor analysis.
- The Internet Archive source is also a pair of 1.3 GB ISO images rather than an
  HTTP cartoon feed. Using its cartoons requires local extraction/storage or a
  separately hosted derivative index, changing the no-storage architecture.
- Pangram Gallery links back to the NextML dataset, labels the source and
  noncommercial terms, and does not persist image bytes. The AI2 mirror avoids
  NextML's multi-megabyte original image files; a live sample returned a
  17,185-byte image.
- Cartoon Bank is the clearest path if licensed access becomes worthwhile.
