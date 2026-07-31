const MET_API = 'https://collectionapi.metmuseum.org/public/collection/v1';
const ARTIC_API = 'https://api.artic.edu/api/v1';
const POETRY_API = 'https://poetrydb.org';
const NASA_APOD_API = 'https://api.nasa.gov/planetary/apod';
const NEW_YORKER_FEEDS = Object.freeze({
  'newyorker-latest': 'https://www.newyorker.com/feed/latest/rss'
});
const NEXTML_ROWS_API =
  'https://datasets-server.huggingface.co/filter?dataset=jmhessel/newyorker_caption_contest&config=ranking_from_pixels&split=train&where=%22contest_number%22%3E%3D508';
const NEXTML_ROW_COUNT = 834;
const MET_SEARCH_TERMS = [
  'bird',
  'cat',
  'flower',
  'garden',
  'landscape',
  'moon',
  'ocean',
  'portrait',
  'river',
  'tree'
];

function textOr(value, fallback) {
  return typeof value === 'string' && value.trim()
    ? value.trim().replace(/\s+/g, ' ')
    : fallback;
}

function uniqueLocation(parts, fallback) {
  const values = parts
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());
  return [...new Set(values)].join(', ') || fallback;
}

export function buildMetReplacement(record) {
  if (!record?.isPublicDomain) return null;
  const assetUrl = record.primaryImageSmall || record.primaryImage;
  if (!assetUrl || !record.objectID) return null;

  return {
    kind: 'image',
    id: `met-${record.objectID}`,
    assetUrl,
    title: textOr(record.title, 'Untitled'),
    creator: textOr(record.artistDisplayName, 'Unknown artist'),
    date: textOr(record.objectDate, ''),
    location: uniqueLocation(
      [record.city, record.state, record.country, record.region],
      textOr(record.repository, 'The Metropolitan Museum of Art, New York')
    ),
    sourceUrl:
      record.objectURL ||
      `https://www.metmuseum.org/art/collection/search/${record.objectID}`,
    rights: 'CC0',
    credit: 'The Metropolitan Museum of Art, Open Access',
    provider: 'The Met'
  };
}

export function buildArticReplacement(record, iiifUrl) {
  if (!record?.is_public_domain || !record.image_id || !record.id || !iiifUrl) {
    return null;
  }

  return {
    kind: 'image',
    id: `artic-${record.id}`,
    assetUrl: `${iiifUrl}/${record.image_id}/full/960,/0/default.jpg`,
    title: textOr(record.title, 'Untitled'),
    creator: textOr(record.artist_display, 'Unknown artist'),
    date: textOr(record.date_display, ''),
    location: textOr(
      record.place_of_origin,
      'Art Institute of Chicago, Chicago'
    ),
    sourceUrl: `https://www.artic.edu/artworks/${record.id}`,
    rights: 'CC0',
    credit: 'Art Institute of Chicago, CC0 Public Domain Designation',
    provider: 'Art Institute of Chicago'
  };
}

export function buildPoetryReplacement(record) {
  const lines = Array.isArray(record?.lines)
    ? record.lines
        .map((line) => (typeof line === 'string' ? line.trimEnd() : ''))
        .filter((line, index, values) => line || (index > 0 && values[index - 1]))
    : [];
  if (!lines.length) return null;

  const title = textOr(record.title, 'Untitled');
  const creator = textOr(record.author, 'Unknown poet');
  return {
    kind: 'poem',
    id: `poetry-${encodeURIComponent(`${creator}-${title}`)}`,
    title,
    creator,
    lines,
    location: creator,
    sourceUrl: 'https://poetrydb.org',
    rights: 'PoetryDB API',
    credit: 'PoetryDB',
    provider: 'PoetryDB'
  };
}

export function buildNasaReplacement(record) {
  if (record?.media_type !== 'image' || !record.url) return null;
  const date = textOr(record.date, '');
  const creator = textOr(record.copyright, 'NASA');
  const compactDate = date.replaceAll('-', '').slice(2);

  return {
    kind: 'image',
    id: `nasa-${date || encodeURIComponent(record.url)}`,
    assetUrl: record.url,
    title: textOr(record.title, 'Astronomy Picture of the Day'),
    creator,
    date,
    location: date ? `${creator} · ${date}` : creator,
    sourceUrl: compactDate
      ? `https://apod.nasa.gov/apod/ap${compactDate}.html`
      : 'https://apod.nasa.gov/apod/',
    rights: record.copyright ? `© ${creator}` : 'NASA media',
    credit: 'NASA Astronomy Picture of the Day',
    provider: 'NASA APOD'
  };
}

export function buildNextMlReplacement(record) {
  const contestNumber = Number(record?.contest_number);
  const assetUrl = record?.image?.src;
  const captions = Array.isArray(record?.caption_choices)
    ? record.caption_choices
    : [];
  const winnerIndex = record?.label === 'B' ? 1 : 0;
  const winningCaption = textOr(
    captions[winnerIndex],
    `Cartoon Caption Contest #${contestNumber}`
  );

  if (
    !Number.isInteger(contestNumber) ||
    contestNumber < 1 ||
    typeof assetUrl !== 'string' ||
    !assetUrl.startsWith('https://')
  ) {
    return null;
  }

  return {
    kind: 'image',
    id: `nextml-${contestNumber}-${textOr(record.instance_id, String(winnerIndex))}`,
    assetUrl,
    title: winningCaption,
    creator: 'The New Yorker',
    location: `The New Yorker Caption Contest #${contestNumber}`,
    sourceUrl: 'https://nextml.github.io/caption-contest-data/',
    rights: 'Noncommercial dataset',
    credit: 'NextML and AI2 Caption Contest corpus',
    provider: 'NextML Caption Contest'
  };
}

function decodeXml(value) {
  return String(value || '')
    .trim()
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, '$1')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .trim();
}

function readXmlTag(block, tagName) {
  const escapedName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(
    new RegExp(`<${escapedName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedName}>`, 'i')
  );
  return decodeXml(match?.[1]);
}

function readThumbnailUrl(block) {
  const tag = block.match(/<media:thumbnail\b[^>]*>/i)?.[0];
  const match = tag?.match(/\burl=(?:"([^"]+)"|'([^']+)')/i);
  const assetUrl = decodeXml(match?.[1] || match?.[2]);
  return assetUrl.replace('/master/pass/', '/master/w_960,c_limit/');
}

export function parseNewYorkerFeed(xml) {
  const blocks = String(xml || '').match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  const items = blocks
    .map((block, index) => {
      const sourceUrl = readXmlTag(block, 'link');
      const category = readXmlTag(block, 'category');
      const creator =
        readXmlTag(block, 'dc:creator') || readXmlTag(block, 'author');
      const assetUrl = readThumbnailUrl(block);
      if (!sourceUrl || !assetUrl || /\.gif(?:$|[?#])/i.test(assetUrl)) {
        return null;
      }

      return {
        kind: 'image',
        id: `newyorker-${encodeURIComponent(sourceUrl || index)}`,
        assetUrl,
        title: readXmlTag(block, 'title') || 'The New Yorker',
        creator: creator || 'The New Yorker',
        location: creator || category || 'The New Yorker',
        sourceUrl,
        rights: 'Publisher RSS',
        credit: 'The New Yorker RSS',
        provider: 'The New Yorker'
      };
    })
    .filter(Boolean);

  return items;
}

export function chooseEnabledProvider(providers = {}, random = Math.random) {
  const enabled = ['met', 'artic'].filter((id) => providers[id] !== false);
  if (!enabled.length) return null;
  return enabled[Math.floor(random() * enabled.length) % enabled.length];
}

async function fetchText(url, fetchFn, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, text/plain'
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Provider request failed with ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, fetchFn, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Provider request failed with ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMetReplacement(fetchFn, random) {
  const term = MET_SEARCH_TERMS[
    Math.floor(random() * MET_SEARCH_TERMS.length) % MET_SEARCH_TERMS.length
  ];
  const search = await fetchJson(
    `${MET_API}/search?hasImages=true&q=${encodeURIComponent(term)}`,
    fetchFn
  );
  const ids = Array.isArray(search.objectIDs) ? search.objectIDs : [];
  if (!ids.length) throw new Error('The Met returned no matching objects');

  const start = Math.floor(random() * ids.length) % ids.length;
  const attempts = Math.min(6, ids.length);

  for (let index = 0; index < attempts; index += 1) {
    const objectId = ids[(start + index) % ids.length];
    const record = await fetchJson(`${MET_API}/objects/${objectId}`, fetchFn);
    const replacement = buildMetReplacement(record);
    if (replacement) return replacement;
  }

  throw new Error('The Met returned no usable public-domain image');
}

async function fetchArticReplacement(fetchFn, random) {
  const page = 1 + Math.floor(random() * 50);
  const fields = [
    'id',
    'title',
    'artist_display',
    'date_display',
    'place_of_origin',
    'image_id',
    'is_public_domain'
  ].join(',');
  const payload = await fetchJson(
    `${ARTIC_API}/artworks?is_public_domain=true&limit=100&page=${page}&fields=${fields}`,
    fetchFn
  );
  const records = Array.isArray(payload.data)
    ? payload.data.filter((record) => record?.is_public_domain && record?.image_id)
    : [];
  if (!records.length) {
    throw new Error('Art Institute returned no usable public-domain image');
  }

  const record = records[Math.floor(random() * records.length) % records.length];
  const iiifUrl = payload.config?.iiif_url || 'https://www.artic.edu/iiif/2';
  const replacement = buildArticReplacement(record, iiifUrl);
  if (!replacement) throw new Error('Art Institute record was incomplete');
  return replacement;
}

async function fetchPoetryReplacement(fetchFn) {
  const payload = await fetchJson(`${POETRY_API}/random/1`, fetchFn);
  const record = Array.isArray(payload) ? payload[0] : payload;
  const replacement = buildPoetryReplacement(record);
  if (!replacement) throw new Error('PoetryDB returned no usable poem');
  return replacement;
}

async function fetchNasaReplacement(fetchFn, random) {
  const payload = await fetchJson(
    `${NASA_APOD_API}?api_key=DEMO_KEY&count=5&thumbs=true`,
    fetchFn
  );
  const records = (Array.isArray(payload) ? payload : [payload])
    .map(buildNasaReplacement)
    .filter(Boolean);
  if (!records.length) throw new Error('NASA APOD returned no image');
  return records[Math.floor(random() * records.length) % records.length];
}

async function fetchNextMlReplacement(fetchFn, random) {
  const offset = Math.floor(random() * NEXTML_ROW_COUNT) % NEXTML_ROW_COUNT;
  const payload = await fetchJson(
    `${NEXTML_ROWS_API}&offset=${offset}&length=1`,
    fetchFn
  );
  const replacement = buildNextMlReplacement(payload?.rows?.[0]?.row);
  if (!replacement) {
    throw new Error('NextML returned no usable Caption Contest cartoon');
  }
  return replacement;
}

async function fetchNewYorkerReplacement(stream, fetchFn, random) {
  const xml = await fetchText(NEW_YORKER_FEEDS[stream], fetchFn);
  const items = parseNewYorkerFeed(xml);
  if (!items.length) throw new Error('The New Yorker feed returned no usable items');
  return items[Math.floor(random() * items.length) % items.length];
}

function streamForVerdict(settings, verdict) {
  const streams = settings?.streams || {};
  if (settings?.styleMode !== 'different') return streams.ai || 'art';
  return verdict === 'mixed' ? streams.mixed || 'art' : streams.ai || 'art';
}

export async function getReplacement(
  settings,
  verdict = 'ai',
  fetchFn = fetch,
  random = Math.random
) {
  const stream = streamForVerdict(settings, verdict);
  if (stream === 'poetry') return fetchPoetryReplacement(fetchFn);
  if (stream === 'nasa') return fetchNasaReplacement(fetchFn, random);
  if (stream === 'newyorker-cartoons') {
    return fetchNextMlReplacement(fetchFn, random);
  }
  if (NEW_YORKER_FEEDS[stream]) {
    return fetchNewYorkerReplacement(stream, fetchFn, random);
  }

  const enabled = ['met', 'artic'].filter(
    (id) => settings?.providers?.[id] !== false
  );
  if (!enabled.length) enabled.push('met');

  const first = chooseEnabledProvider(settings?.providers, random) || enabled[0];
  const order = [first, ...enabled.filter((id) => id !== first)];
  const errors = [];

  for (const provider of order) {
    try {
      if (provider === 'met') {
        return await fetchMetReplacement(fetchFn, random);
      }
      return await fetchArticReplacement(fetchFn, random);
    } catch (error) {
      errors.push(`${provider}: ${error.message}`);
    }
  }

  throw new Error(errors.join('; ') || 'No replacement source was available');
}
