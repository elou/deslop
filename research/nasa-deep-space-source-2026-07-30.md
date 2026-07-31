# NASA deep-space source exploration

Research date: 2026-07-30

## Finding

The current NASA stream uses random Astronomy Picture of the Day records:

`https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&count=5&thumbs=true`

APOD intentionally covers more than deep-space photography. A random batch can
contain Earth weather, panoramas, diagrams, videos, spacecraft, or historical
mission imagery. Filtering five random records cannot reliably produce the
supernovae, nebulae, and galaxy images expected from the stream name.

## Recommended replacement: NASA Image and Video Library

Use the official, keyless Image Library API:

- Search: `https://images-api.nasa.gov/search`
- Asset manifest: `https://images-api.nasa.gov/asset/{nasa_id}`
- Detail page: `https://images.nasa.gov/details/{nasa_id}`

The API explicitly supports CORS and returns structured title, date, center,
description, keywords, NASA ID, and preview information.

Use a narrow rotating query pool such as:

- `supernova remnant`
- `nebula`
- `galaxy cluster`
- `Hubble deep field`
- `James Webb nebula`

Reject obvious hardware, launch, people, map, diagram, weather, and illustration
results. Then fetch the selected NASA ID's asset manifest and choose the best
optimized rendition in this order:

1. `~large`
2. `~medium`
3. `~small`

Never choose `~orig` in the feed. The optimized images are already large enough
to fill the card and protect the browser from huge originals.

## Live probe

Official search results included:

- `GSFC_20171208_Archive_e002134` — *Supernova Remnant W49B*
- `PIA11435` — *Vivid View of Tycho Supernova Remnant*
- `PIA04220` — *Trifid Nebula*
- `PIA12110` — *Hubble Deep Field Image Unveils Myriad Galaxies Back to the
  Beginning of Time*
- `PIA26702` — *Webb Data Reveals Dark Matter*

Sampled optimized renditions ranged from 930–1,920 pixels. File-size comparisons
show why the extension should avoid originals:

| Asset | Chosen rendition | Chosen bytes | Original bytes |
| --- | ---: | ---: | ---: |
| Supernova Remnant W49B | 1,920 × 1,737 large | 713,643 | 6,317,481 |
| Hubble Deep Field | 1,246 × 1,280 medium | 459,864 | 1,231,625 |
| Webb dark-matter image | 1,724 × 1,920 large | 561,141 | 44,956,312 |

The resulting stream should be named **Deep Space**, with
`NASA Image and Video Library` as the source, rather than implying that a random
APOD stream is limited to astronomical beauty shots.

## Rights

NASA states that its content is generally not subject to copyright in the
United States and may be used for educational or informational purposes,
including personal web pages. NASA should be credited, and records carrying a
third-party copyright notice should be omitted or labeled separately.

Sources:

- https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf
- https://images.nasa.gov/
- https://www.nasa.gov/nasa-brand-center/images-and-media/
