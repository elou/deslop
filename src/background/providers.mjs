const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const FREEVERSE_INDEX = 'https://thefreeverse.org/api/search-index.json';
const FREEVERSE_RAW =
  'https://raw.githubusercontent.com/Spitfire-Cowboy/freeverse/main/poems';
const WIKIART_FILTER_API =
  'https://datasets-server.huggingface.co/filter?dataset=huggan%2Fwikiart&config=default&split=train';
const WIKIART_MODERN_STYLE_IDS = Object.freeze([
  0, 1, 2, 5, 6, 7, 9, 10, 14, 16, 19, 25
]);
const NASA_SEARCH_API = 'https://images-api.nasa.gov/search';
const NASA_ASSET_API = 'https://images-api.nasa.gov/asset';
const NASA_DEEP_SPACE_QUERIES = Object.freeze([
  'supernova remnant',
  'nebula',
  'galaxy cluster',
  'Hubble deep field',
  'James Webb nebula'
]);
const MODERN_ART_STYLES = new Set([
  'Abstract_Expressionism',
  'Action_painting',
  'Analytical_Cubism',
  'Color_Field_Painting',
  'Contemporary_Realism',
  'Cubism',
  'Expressionism',
  'Fauvism',
  'Minimalism',
  'New_Realism',
  'Pop_Art',
  'Synthetic_Cubism'
]);

// Generated from Wikidata's bot-maintained "Most Famous Paintings of the
// World" catalog. The list is routing metadata; image bytes and rights are
// fetched and checked live from Wikimedia Commons.
const PAINTING_CLASSICS_IDS = Object.freeze([
  'Q128910',
  'Q257580',
  'Q19660528',
  'Q26708017',
  'Q315716',
  'Q7731855',
  'Q1227359',
  'Q22116938',
  'Q41637000',
  'Q275349',
  'Q8242264',
  'Q3960008',
  'Q186953',
  'Q220859',
  'Q1195610',
  'Q41637697',
  'Q1133881',
  'Q500812',
  'Q16649045',
  'Q28777968',
  'Q603751',
  'Q588695',
  'Q151047',
  'Q21129709',
  'Q1091086',
  'Q12418',
  'Q463392',
  'Q727875',
  'Q241455',
  'Q2881603',
  'Q644936',
  'Q21091458',
  'Q2714617',
  'Q1131176',
  'Q30064813',
  'Q219831',
  'Q951105',
  'Q2609585',
  'Q328079',
  'Q1787143',
  'Q1140358',
  'Q3937806',
  'Q29530',
  'Q829270',
  'Q24283',
  'Q3937485',
  'Q476458',
  'Q3172087',
  'Q20808604',
  'Q9183696',
  'Q3642171',
  'Q1257006',
  'Q30071845',
  'Q3822843',
  'Q3235403',
  'Q3756785',
  'Q41668919',
  'Q16937014',
  'Q41662463',
  'Q26221153',
  'Q1044742',
  'Q19818839',
  'Q944909',
  'Q18689440',
  'Q152509',
  'Q3821820',
  'Q328523',
  'Q1219263',
  'Q41704998',
  'Q41658837',
  'Q30068812',
  'Q3607521',
  'Q3797026',
  'Q41670941',
  'Q41668322',
  'Q41696660',
  'Q464782',
  'Q41671803',
  'Q18891074'
]);

function textOr(value, fallback) {
  return typeof value === 'string' && value.trim()
    ? value.trim().replace(/\s+/g, ' ')
    : fallback;
}

function stripMarkup(value) {
  return textOr(String(value || '').replace(/<[^>]*>/g, ''), '');
}

function claimValue(entity, property) {
  return entity?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
}

function linesFromText(value) {
  if (typeof value !== 'string') return [];
  const lines = value
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  while (lines.length && !lines.at(-1)) lines.pop();
  return lines;
}

export function buildFreeverseReplacement(record, text) {
  const lines = linesFromText(text);
  if (!record?.id || !record?.title || !record?.author || !lines.length) {
    return null;
  }

  const poemPath = record.id
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return {
    kind: 'poem',
    id: `freeverse-${encodeURIComponent(record.id)}`,
    title: textOr(record.title, 'Untitled poem'),
    creator: textOr(record.author, 'Unknown poet'),
    lines,
    location: textOr(record.author, 'Freeverse'),
    sourceUrl: `https://thefreeverse.org/poem/${poemPath}/`,
    rights: 'US public domain',
    credit: 'Freeverse',
    provider: 'Freeverse',
    rawUrl: `${FREEVERSE_RAW}/${poemPath}.txt`
  };
}

export function buildPaintingClassicsReplacement(
  entity,
  artistEntity,
  imageInfo
) {
  const id = entity?.id;
  const image = imageInfo;
  const metadata = image?.extmetadata || {};
  const license = stripMarkup(metadata.LicenseShortName?.value);
  const copyrighted = stripMarkup(metadata.Copyrighted?.value).toLowerCase();
  const assetUrl = image?.thumburl;
  if (
    !id ||
    !assetUrl?.startsWith('https://') ||
    !['public domain', 'cc0'].includes(license.toLowerCase()) ||
    copyrighted !== 'false'
  ) {
    return null;
  }

  const artistId = claimValue(entity, 'P170')?.id;
  const date = claimValue(entity, 'P571')?.time?.slice(1, 11) || '';
  const credit = stripMarkup(metadata.Credit?.value);
  const location = credit && !/^unknown source/i.test(credit)
    ? credit
    : 'Wikimedia Commons';
  return {
    kind: 'image',
    id: `painting-classics-${id}`,
    assetUrl,
    title: textOr(entity.labels?.en?.value, 'Untitled painting'),
    creator: textOr(
      artistEntity?.labels?.en?.value,
      artistId ? 'Unknown artist' : 'Unknown artist'
    ),
    date,
    location,
    sourceUrl:
      image.descriptionurl || `https://www.wikidata.org/wiki/${id}`,
    rights: license.toLowerCase() === 'cc0' ? 'CC0' : 'Public domain',
    credit: 'Wikidata · Wikimedia Commons',
    provider: 'Painting Classics'
  };
}

export function buildModernArtReplacement(row, features = []) {
  const image = row?.image;
  if (!image?.src?.startsWith('https://')) return null;

  const labels = Object.fromEntries(
    features.map((feature) => [feature.name, feature.type?.names || []])
  );
  const label = (name, value, fallback) =>
    labels[name]?.[value] || fallback;
  const artist = label('artist', row.artist, 'Unknown artist');
  const genre = label('genre', row.genre, 'Modern art');
  const style = label('style', row.style, 'Modern art');
  if (!MODERN_ART_STYLES.has(style)) return null;

  return {
    kind: 'image',
    id: `modern-art-${row.image.src.split('/').slice(-3, -2)[0] || row.artist}-${row.style}`,
    assetUrl: image.src,
    title: 'Modern art study',
    creator: artist,
    location: `${style.replaceAll('_', ' ')} · ${genre.replaceAll('_', ' ')}`,
    sourceUrl: 'https://huggingface.co/datasets/huggan/wikiart',
    rights: 'Noncommercial research',
    credit: 'WikiArt research corpus',
    provider: 'Modern Art'
  };
}

export function buildNasaDeepSpaceReplacement(record, assetUrl) {
  if (
    record?.media_type !== 'image' ||
    !record.nasa_id ||
    !assetUrl?.startsWith('https://')
  ) {
    return null;
  }

  const creator = textOr(record.secondary_creator, 'NASA');
  const date = textOr(record.date_created, '');
  const rights = textOr(record.copyright, 'NASA media');
  return {
    kind: 'image',
    id: `deep-space-${record.nasa_id}`,
    assetUrl,
    title: textOr(record.title, 'Deep-space image'),
    creator,
    date,
    location: date ? `${creator} · ${date.slice(0, 10)}` : creator,
    sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(record.nasa_id)}`,
    rights: rights.startsWith('©') ? rights : rights === 'NASA media' ? rights : `© ${rights}`,
    credit: 'NASA Image and Video Library',
    provider: 'Deep Space'
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
  return blocks
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

function chooseIndex(length, random) {
  return length ? Math.floor(random() * length) % length : 0;
}

async function fetchPaintingClassicsReplacement(fetchFn, random) {
  const start = chooseIndex(PAINTING_CLASSICS_IDS.length, random);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = PAINTING_CLASSICS_IDS[(start + attempt) % PAINTING_CLASSICS_IDS.length];
    const entityUrl = new URL(WIKIDATA_API);
    entityUrl.searchParams.set('action', 'wbgetentities');
    entityUrl.searchParams.set('format', 'json');
    entityUrl.searchParams.set('ids', id);
    entityUrl.searchParams.set('props', 'labels|claims');
    entityUrl.searchParams.set('languages', 'en');
    const entityPayload = await fetchJson(entityUrl.toString(), fetchFn);
    const entity = entityPayload.entities?.[id];
    const imageFile = claimValue(entity, 'P18');
    if (!imageFile) continue;

    const artistId = claimValue(entity, 'P170')?.id;
    let artistEntity = null;
    if (artistId) {
      const artistUrl = new URL(WIKIDATA_API);
      artistUrl.searchParams.set('action', 'wbgetentities');
      artistUrl.searchParams.set('format', 'json');
      artistUrl.searchParams.set('ids', artistId);
      artistUrl.searchParams.set('props', 'labels');
      artistUrl.searchParams.set('languages', 'en');
      artistEntity = (await fetchJson(artistUrl.toString(), fetchFn)).entities?.[
        artistId
      ];
    }

    const commonsUrl = new URL(COMMONS_API);
    commonsUrl.searchParams.set('action', 'query');
    commonsUrl.searchParams.set('format', 'json');
    commonsUrl.searchParams.set('prop', 'imageinfo');
    commonsUrl.searchParams.set('titles', `File:${imageFile}`);
    commonsUrl.searchParams.set(
      'iiprop',
      'url|extmetadata'
    );
    commonsUrl.searchParams.set('iiurlwidth', '960');
    commonsUrl.searchParams.set(
      'iiextmetadatafilter',
      'LicenseShortName|Copyrighted|Credit'
    );
    const commonsPayload = await fetchJson(commonsUrl.toString(), fetchFn);
    const page = Object.values(commonsPayload.query?.pages || {})[0];
    const imageInfo = page?.imageinfo?.[0];
    const replacement = buildPaintingClassicsReplacement(
      entity,
      artistEntity,
      imageInfo
    );
    if (replacement) return replacement;
  }

  throw new Error('Painting Classics returned no usable public-domain image');
}

async function fetchFreeverseReplacement(fetchFn, random) {
  const payload = await fetchJson(FREEVERSE_INDEX, fetchFn);
  const poems = Array.isArray(payload?.poems) ? payload.poems : [];
  if (!poems.length) throw new Error('Freeverse returned no poems');

  const authors = [...new Set(poems.map((poem) => poem.author).filter(Boolean))];
  const author = authors[chooseIndex(authors.length, random)];
  const candidates = poems.filter((poem) => poem.author === author && poem.id);
  const record = candidates[chooseIndex(candidates.length, random)];
  if (!record) throw new Error('Freeverse returned no usable poem');

  const poemPath = record.id
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  const text = await fetchText(`${FREEVERSE_RAW}/${poemPath}.txt`, fetchFn);
  const replacement = buildFreeverseReplacement(record, text);
  if (!replacement) throw new Error('Freeverse returned empty poem text');
  return replacement;
}

async function fetchModernArtReplacement(fetchFn, random) {
  const styleId = WIKIART_MODERN_STYLE_IDS[
    chooseIndex(WIKIART_MODERN_STYLE_IDS.length, random)
  ];
  const filterUrl = new URL(WIKIART_FILTER_API);
  filterUrl.searchParams.set('where', `"style"=${styleId}`);
  filterUrl.searchParams.set('offset', '0');
  // One row keeps the Hugging Face filter response small enough for a feed
  // replacement request while the style pool supplies variety across calls.
  filterUrl.searchParams.set('length', '1');
  const payload = await fetchJson(filterUrl.toString(), fetchFn);
  const rows = payload?.rows || [];
  if (rows.length) {
    const start = chooseIndex(rows.length, random);
    for (let attempt = 0; attempt < rows.length; attempt += 1) {
      const row = rows[(start + attempt) % rows.length]?.row;
      const replacement = buildModernArtReplacement(row, payload?.features || []);
      if (replacement) return replacement;
    }
  }
  throw new Error('Modern Art returned no usable research image');
}

function isDeepSpaceRecord(record) {
  if (record?.media_type !== 'image' || !record.nasa_id) return false;
  const text = [record.title, record.description, ...(record.keywords || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (
    /\b(earth|weather|storm|hurricane|launch|telescope|spacecraft|rocket|astronaut|diagram|illustration|map|concept|rollout|deployment)\b/i.test(
      text
    )
  ) {
    return false;
  }
  return /supernova|nebula|galaxy|deep field|dark matter|star cluster|cosmic|quasar|black hole|stellar/i.test(
    text
  );
}

function chooseNasaRendition(items = []) {
  const urls = items
    .map((item) => item?.href)
    .filter((href) => typeof href === 'string' && href.startsWith('http'))
    .map((href) => href.replace(/^http:/, 'https:'));
  return (
    urls.find((url) => /~large\.(?:jpe?g|png|webp)$/i.test(url)) ||
    urls.find((url) => /~medium\.(?:jpe?g|png|webp)$/i.test(url)) ||
    urls.find((url) => /~small\.(?:jpe?g|png|webp)$/i.test(url)) ||
    null
  );
}

async function fetchDeepSpaceReplacement(fetchFn, random) {
  const query = NASA_DEEP_SPACE_QUERIES[
    chooseIndex(NASA_DEEP_SPACE_QUERIES.length, random)
  ];
  const searchUrl = new URL(NASA_SEARCH_API);
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('media_type', 'image');
  searchUrl.searchParams.set('page_size', '20');
  const payload = await fetchJson(searchUrl.toString(), fetchFn);
  const records = (payload.collection?.items || [])
    .map((item) => item.data?.[0])
    .filter(isDeepSpaceRecord);
  if (!records.length) throw new Error('NASA returned no deep-space images');

  const start = chooseIndex(records.length, random);
  for (let attempt = 0; attempt < Math.min(6, records.length); attempt += 1) {
    const record = records[(start + attempt) % records.length];
    const assetPayload = await fetchJson(
      `${NASA_ASSET_API}/${encodeURIComponent(record.nasa_id)}`,
      fetchFn
    );
    const assetUrl = chooseNasaRendition(assetPayload.collection?.items);
    const replacement = buildNasaDeepSpaceReplacement(record, assetUrl);
    if (replacement) return replacement;
  }
  throw new Error('NASA returned no optimized deep-space image');
}

async function fetchNextMlReplacement(fetchFn, random) {
  const offset = chooseIndex(834, random);
  const url = new URL(
    'https://datasets-server.huggingface.co/filter?dataset=jmhessel/newyorker_caption_contest&config=ranking_from_pixels&split=train&where=%22contest_number%22%3E%3D508'
  );
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('length', '1');
  const payload = await fetchJson(url.toString(), fetchFn);
  const replacement = buildNextMlReplacement(payload?.rows?.[0]?.row);
  if (!replacement) {
    throw new Error('NextML returned no usable Caption Contest cartoon');
  }
  return replacement;
}

async function fetchNewYorkerReplacement(stream, fetchFn, random) {
  const feeds = {
    'newyorker-latest': 'https://www.newyorker.com/feed/latest/rss'
  };
  const xml = await fetchText(feeds[stream], fetchFn);
  const items = parseNewYorkerFeed(xml);
  if (!items.length) throw new Error('The New Yorker feed returned no usable items');
  return items[chooseIndex(items.length, random)];
}

function streamForVerdict(settings, verdict) {
  const streams = settings?.streams || {};
  if (settings?.styleMode !== 'different') {
    return streams.ai || 'painting-classics';
  }
  return verdict === 'mixed'
    ? streams.mixed || 'painting-classics'
    : streams.ai || 'painting-classics';
}

export async function getReplacement(
  settings,
  verdict = 'ai',
  fetchFn = fetch,
  random = Math.random
) {
  const stream = streamForVerdict(settings, verdict);
  if (stream === 'painting-classics') {
    return fetchPaintingClassicsReplacement(fetchFn, random);
  }
  if (stream === 'classic-poetry') {
    return fetchFreeverseReplacement(fetchFn, random);
  }
  if (stream === 'modern-art') {
    return fetchModernArtReplacement(fetchFn, random);
  }
  if (stream === 'deep-space') {
    return fetchDeepSpaceReplacement(fetchFn, random);
  }
  if (stream === 'newyorker-cartoons') {
    return fetchNextMlReplacement(fetchFn, random);
  }
  if (stream === 'newyorker-latest') {
    return fetchNewYorkerReplacement(stream, fetchFn, random);
  }
  return fetchPaintingClassicsReplacement(fetchFn, random);
}
