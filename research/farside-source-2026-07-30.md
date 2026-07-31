# Far Side dataset source

Research date: 2026-07-30

## Finding

The Hugging Face dataset [maderix/farsidecomics-blip-captions](https://huggingface.co/datasets/maderix/farsidecomics-blip-captions) exposes 354 training rows with two fields:

- `image`: a comic image returned as a signed Hugging Face dataset-server URL
- `text`: a BLIP-generated caption

The dataset-server rows endpoint works without a local download:

`https://datasets-server.huggingface.co/rows?dataset=maderix%2Ffarsidecomics-blip-captions&config=default&split=train&offset=0&length=1`

The sampled image returned HTTP 200 and was 54,546 bytes. The dataset is small enough to sample by row without a media store.

## Rights and product treatment

The dataset card says “More Information needed” and does not declare a license. The rows appear to be scans or reproductions of The Far Side comics, which remain copyrighted. The extension therefore labels the stream **Far Side (experimental)** and `Copyrighted · noncommercial dataset`; it is not included in the public-domain/CC0 Art pool.

The BLIP captions are noisy and should not be presented as authoritative comic titles. The card uses “The Far Side” as the title and preserves the generated caption as metadata for future UI use.

## Implementation

- Provider: `far-side`
- Source: Hugging Face dataset server, 354 rows
- Image bytes: fetched at display time from signed dataset-server URLs
- Source link: the dataset page
- No local corpus or image storage
