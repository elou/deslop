import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildArticReplacement,
  buildMetReplacement,
  chooseEnabledProvider,
  getReplacement
} from '../src/background/providers.mjs';

test('accepts a public-domain Met object with an image', () => {
  const item = buildMetReplacement({
    objectID: 436535,
    title: 'Wheat Field with Cypresses',
    artistDisplayName: 'Vincent van Gogh',
    objectDate: '1889',
    country: 'France',
    objectURL: 'https://www.metmuseum.org/art/collection/search/436535',
    primaryImageSmall: 'https://images.metmuseum.org/example.jpg',
    isPublicDomain: true
  });

  assert.equal(item.provider, 'The Met');
  assert.equal(item.rights, 'CC0');
  assert.equal(item.creator, 'Vincent van Gogh');
  assert.equal(item.location, 'France');
  assert.match(item.assetUrl, /^https:\/\//);
});

test('rejects Met objects without explicit public-domain status', () => {
  assert.equal(
    buildMetReplacement({
      objectID: 1,
      title: 'Restricted work',
      primaryImageSmall: 'https://images.metmuseum.org/example.jpg',
      isPublicDomain: false
    }),
    null
  );
});

test('builds an Art Institute image only from an explicit public-domain record', () => {
  const item = buildArticReplacement(
    {
      id: 27992,
      title: 'A Sunday on La Grande Jatte',
      artist_display: 'Georges Seurat',
      date_display: '1884–86',
      place_of_origin: 'Paris, France',
      image_id: '8315b9f7-4bad-0f8d-3f2b-c73ff21d58ed',
      is_public_domain: true
    },
    'https://www.artic.edu/iiif/2'
  );

  assert.equal(item.provider, 'Art Institute of Chicago');
  assert.equal(item.rights, 'CC0');
  assert.equal(item.location, 'Paris, France');
  assert.match(item.assetUrl, /\/full\/960,\/0\/default\.jpg$/);
  assert.equal(item.sourceUrl, 'https://www.artic.edu/artworks/27992');
});

test('rejects an Art Institute record without an image or rights flag', () => {
  assert.equal(
    buildArticReplacement({ id: 1, image_id: null, is_public_domain: true }),
    null
  );
  assert.equal(
    buildArticReplacement({ id: 2, image_id: 'image', is_public_domain: false }),
    null
  );
});

test('chooses only from enabled providers', () => {
  assert.equal(
    chooseEnabledProvider({ met: false, artic: true }, () => 0),
    'artic'
  );
  assert.equal(
    chooseEnabledProvider({ met: true, artic: false }, () => 0.99),
    'met'
  );
});

test('falls back to the other enabled provider when the first source fails', async () => {
  const fetchFn = async (url) => {
    if (url.includes('metmuseum.org')) {
      return { ok: false, status: 503, json: async () => ({}) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: 42,
            title: 'Fallback work',
            artist_display: 'An artist',
            date_display: '1901',
            place_of_origin: 'Chicago',
            image_id: 'fallback-image',
            is_public_domain: true
          }
        ],
        config: { iiif_url: 'https://www.artic.edu/iiif/2' }
      })
    };
  };

  const item = await getReplacement(
    { providers: { met: true, artic: true } },
    fetchFn,
    () => 0
  );

  assert.equal(item.provider, 'Art Institute of Chicago');
  assert.equal(item.rights, 'CC0');
});
