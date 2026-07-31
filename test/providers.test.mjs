import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildArticReplacement,
  buildMetReplacement,
  buildNasaReplacement,
  buildNextMlReplacement,
  buildPoetryReplacement,
  chooseEnabledProvider,
  getReplacement,
  parseNewYorkerFeed
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
  assert.equal(item.kind, 'image');
  assert.equal(item.rights, 'CC0');
  assert.equal(item.creator, 'Vincent van Gogh');
  assert.equal(item.location, 'France');
  assert.match(item.assetUrl, /^https:\/\//);
});

test('builds a poem replacement with its original line breaks', () => {
  const item = buildPoetryReplacement({
    title: 'Hope',
    author: 'Emily Dickinson',
    lines: ['“Hope” is the thing with feathers –', 'That perches in the soul –']
  });

  assert.equal(item.kind, 'poem');
  assert.equal(item.provider, 'PoetryDB');
  assert.equal(item.creator, 'Emily Dickinson');
  assert.deepEqual(item.lines, [
    '“Hope” is the thing with feathers –',
    'That perches in the soul –'
  ]);
});

test('builds an image-only NASA APOD replacement with visible credit', () => {
  const item = buildNasaReplacement({
    date: '2026-07-30',
    media_type: 'image',
    title: 'A galaxy',
    url: 'https://apod.nasa.gov/example.jpg',
    copyright: 'A Photographer'
  });

  assert.equal(item.kind, 'image');
  assert.equal(item.provider, 'NASA APOD');
  assert.equal(item.rights, '© A Photographer');
  assert.match(item.sourceUrl, /ap260730\.html$/);
  assert.equal(buildNasaReplacement({ media_type: 'video', url: 'video' }), null);
});

test('builds a bounded NextML Caption Contest replacement', () => {
  const item = buildNextMlReplacement({
    contest_number: 556,
    image: {
      src: 'https://datasets-server.huggingface.co/cached-assets/cartoon.jpg',
      width: 600,
      height: 471
    },
    caption_choices: ['Another executive order?', 'We had meth on Tuesday.'],
    label: 'B',
    instance_id: 'contest-row'
  });

  assert.equal(item.kind, 'image');
  assert.equal(item.provider, 'NextML Caption Contest');
  assert.equal(item.title, 'We had meth on Tuesday.');
  assert.equal(item.location, 'The New Yorker Caption Contest #556');
  assert.equal(item.rights, 'Noncommercial dataset');
});

test('rejects incomplete NextML Caption Contest rows', () => {
  assert.equal(
    buildNextMlReplacement({
      contest_number: 556,
      image: { src: 'http://example.com/cartoon.jpg' }
    }),
    null
  );
});

test('parses official New Yorker RSS thumbnails', () => {
  const xml = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title><![CDATA[The Cartoon Caption Contest]]></title>
        <link>https://www.newyorker.com/cartoons/contest</link>
        <category>Cartoons</category>
        <dc:creator><![CDATA[The New Yorker]]></dc:creator>
        <media:thumbnail url="https://media.newyorker.com/cartoon.jpg" />
      </item>
      <item>
        <title>News &amp; notes</title>
        <link>https://www.newyorker.com/news/example</link>
        <media:thumbnail url="https://media.newyorker.com/news.jpg" />
      </item>
    </channel></rss>`;

  const latest = parseNewYorkerFeed(xml);

  assert.equal(latest.length, 2);
  assert.equal(latest[1].title, 'News & notes');
  assert.equal(
    latest[0].assetUrl,
    'https://media.newyorker.com/cartoon.jpg'
  );
});

test('caps full-size New Yorker feed images at 960 pixels', () => {
  const xml = `<rss><channel><item>
    <title>Daily Cartoon</title>
    <link>https://www.newyorker.com/cartoons/daily-cartoon</link>
    <media:thumbnail url="https://media.newyorker.com/photos/id/master/pass/cartoon.jpg" />
  </item></channel></rss>`;

  const [item] = parseNewYorkerFeed(xml);
  assert.equal(
    item.assetUrl,
    'https://media.newyorker.com/photos/id/master/w_960,c_limit/cartoon.jpg'
  );
});

test('skips animated New Yorker feed thumbnails', () => {
  const xml = `<rss><channel><item>
    <title>Animated contest entry</title>
    <link>https://www.newyorker.com/cartoons/contest</link>
    <media:thumbnail url="https://media.newyorker.com/photos/id/master/pass/cartoon.gif" />
  </item></channel></rss>`;

  assert.deepEqual(parseNewYorkerFeed(xml), []);
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
    'ai',
    fetchFn,
    () => 0
  );

  assert.equal(item.provider, 'Art Institute of Chicago');
  assert.equal(item.rights, 'CC0');
});

test('routes AI and Mixed verdicts to different streams', async () => {
  const fetchFn = async (url) => {
    assert.match(url, /poetrydb\.org\/random\/1$/);
    return {
      ok: true,
      status: 200,
      json: async () => [
        { title: 'A poem', author: 'A poet', lines: ['A line'] }
      ]
    };
  };

  const item = await getReplacement(
    {
      styleMode: 'different',
      streams: { ai: 'art', mixed: 'poetry' }
    },
    'mixed',
    fetchFn,
    () => 0
  );

  assert.equal(item.kind, 'poem');
});

test('loads the New Yorker cartoons stream from the NextML research corpus', async () => {
  const fetchFn = async (url) => {
    assert.match(url, /datasets-server\.huggingface\.co\/filter/);
    assert.match(url, /where=%22contest_number%22%3E%3D508/);
    assert.match(url, /offset=0&length=1$/);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        rows: [
          {
            row: {
              contest_number: 556,
              image: {
                src: 'https://datasets-server.huggingface.co/cached-assets/cartoon.jpg'
              },
              caption_choices: ['First', 'Winner'],
              label: 'B',
              instance_id: 'row'
            }
          }
        ]
      })
    };
  };

  const item = await getReplacement(
    { streams: { ai: 'newyorker-cartoons' } },
    'ai',
    fetchFn,
    () => 0
  );

  assert.equal(item.provider, 'NextML Caption Contest');
  assert.equal(item.title, 'Winner');
});
