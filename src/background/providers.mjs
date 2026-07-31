const MET_API = 'https://collectionapi.metmuseum.org/public/collection/v1';
const ARTIC_API = 'https://api.artic.edu/api/v1';
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
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
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

export function chooseEnabledProvider(providers = {}, random = Math.random) {
  const enabled = ['met', 'artic'].filter((id) => providers[id] !== false);
  if (!enabled.length) return null;
  return enabled[Math.floor(random() * enabled.length) % enabled.length];
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

export async function getReplacement(
  settings,
  fetchFn = fetch,
  random = Math.random
) {
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
