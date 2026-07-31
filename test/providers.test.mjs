import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFreeverseReplacement,
  buildModernArtReplacement,
  buildNasaDeepSpaceReplacement,
  buildNextMlReplacement,
  buildPaintingClassicsReplacement,
  getReplacement,
  parseNewYorkerFeed
} from '../src/background/providers.mjs';

test('builds a Freeverse poem with its original line breaks', () => {
  const item = buildFreeverseReplacement(
    {
      id: 'Emily-Dickinson/Hope',
      title: '“Hope” is the thing with feathers',
      author: 'Emily Dickinson'
    },
    '“Hope” is the thing with feathers –\nThat perches in the soul –'
  );

  assert.equal(item.kind, 'poem');
  assert.equal(item.provider, 'Freeverse');
  assert.equal(item.rights, 'US public domain');
  assert.equal(item.creator, 'Emily Dickinson');
  assert.deepEqual(item.lines, [
    '“Hope” is the thing with feathers –',
    'That perches in the soul –'
  ]);
});

test('builds a Painting Classics item only from a checked public-domain Commons image', () => {
  const entity = {
    id: 'Q12418',
    labels: { en: { value: 'The Starry Night' } },
    claims: {
      P170: [{ mainsnak: { datavalue: { value: { id: 'Q5582' } } } }],
      P571: [{ mainsnak: { datavalue: { value: { time: '+1889-01-01T00:00:00Z' } } } }]
    }
  };
  const item = buildPaintingClassicsReplacement(
    entity,
    { labels: { en: { value: 'Vincent van Gogh' } } },
    {
      thumburl: 'https://upload.wikimedia.org/example.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
      extmetadata: {
        LicenseShortName: { value: 'Public domain' },
        Copyrighted: { value: 'False' },
        Credit: { value: 'Museum collection' }
      }
    }
  );

  assert.equal(item.provider, 'Painting Classics');
  assert.equal(item.rights, 'Public domain');
  assert.equal(item.creator, 'Vincent van Gogh');
  assert.equal(item.location, 'Museum collection');
  assert.match(item.assetUrl, /^https:\/\//);
});

test('rejects copyrighted or non-public-domain Painting Classics images', () => {
  const entity = { id: 'Q1', labels: { en: { value: 'Restricted work' } } };
  const base = {
    thumburl: 'https://upload.wikimedia.org/example.jpg',
    extmetadata: {
      LicenseShortName: { value: 'CC BY-SA 4.0' },
      Copyrighted: { value: 'True' }
    }
  };

  assert.equal(buildPaintingClassicsReplacement(entity, null, base), null);
});

test('builds a modern-art research item only for a selected modern style', () => {
  const features = [
    { name: 'artist', type: { names: ['Unknown', 'Pablo Picasso'] } },
    { name: 'genre', type: { names: ['portrait'] } },
    { name: 'style', type: { names: ['Cubism'] } }
  ];
  const item = buildModernArtReplacement(
    {
      artist: 1,
      genre: 0,
      style: 0,
      image: { src: 'https://datasets-server.huggingface.co/image.jpg' }
    },
    features
  );

  assert.equal(item.provider, 'Modern Art');
  assert.equal(item.rights, 'Noncommercial research');
  assert.equal(item.creator, 'Pablo Picasso');
  assert.equal(item.location, 'Cubism · portrait');
});

test('rejects modern-art rows outside the experimental style pool', () => {
  assert.equal(
    buildModernArtReplacement(
      {
        artist: 0,
        genre: 0,
        style: 0,
        image: { src: 'https://datasets-server.huggingface.co/image.jpg' }
      },
      [
        { name: 'artist', type: { names: ['Artist'] } },
        { name: 'genre', type: { names: ['genre'] } },
        { name: 'style', type: { names: ['Rococo'] } }
      ]
    ),
    null
  );
});

test('builds an optimized Deep Space NASA replacement', () => {
  const item = buildNasaDeepSpaceReplacement(
    {
      nasa_id: 'W49B',
      media_type: 'image',
      title: 'Supernova Remnant W49B',
      date_created: '2024-01-02',
      secondary_creator: 'NASA/JPL-Caltech'
    },
    'https://images-assets.nasa.gov/image/W49B~large.jpg'
  );

  assert.equal(item.provider, 'Deep Space');
  assert.equal(item.rights, 'NASA media');
  assert.equal(item.title, 'Supernova Remnant W49B');
  assert.match(item.sourceUrl, /images\.nasa\.gov\/details\/W49B/);
});

test('builds a bounded NextML Caption Contest replacement', () => {
  const item = buildNextMlReplacement({
    contest_number: 556,
    image: { src: 'https://datasets-server.huggingface.co/cached-assets/cartoon.jpg' },
    caption_choices: ['Another executive order?', 'We had meth on Tuesday.'],
    label: 'B',
    instance_id: 'contest-row'
  });

  assert.equal(item.provider, 'NextML Caption Contest');
  assert.equal(item.title, 'We had meth on Tuesday.');
  assert.equal(item.rights, 'Noncommercial dataset');
});

test('parses official New Yorker RSS thumbnails and caps image width', () => {
  const xml = `<rss><channel>
    <item><title><![CDATA[The Cartoon Caption Contest]]></title>
      <link>https://www.newyorker.com/cartoons/contest</link>
      <category>Cartoons</category>
      <dc:creator><![CDATA[The New Yorker]]></dc:creator>
      <media:thumbnail url="https://media.newyorker.com/photos/id/master/pass/cartoon.jpg" />
    </item>
    <item><title>News &amp; notes</title>
      <link>https://www.newyorker.com/news/example</link>
      <media:thumbnail url="https://media.newyorker.com/news.jpg" />
    </item>
  </channel></rss>`;

  const items = parseNewYorkerFeed(xml);
  assert.equal(items.length, 2);
  assert.equal(items[1].title, 'News & notes');
  assert.equal(
    items[0].assetUrl,
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

test('routes Classic Poetry through the Freeverse index and raw poem', async () => {
  const fetchFn = async (url) => {
    if (url.endsWith('/search-index.json')) {
      return { ok: true, status: 200, json: async () => ({ poems: [
        { id: 'Emily-Dickinson/Hope', title: 'Hope', author: 'Emily Dickinson' }
      ] }) };
    }
    assert.match(url, /raw\.githubusercontent\.com\/Spitfire-Cowboy\/freeverse/);
    return { ok: true, status: 200, text: async () => 'A line\nAnother line' };
  };

  const item = await getReplacement(
    { streams: { ai: 'classic-poetry' } },
    'ai',
    fetchFn,
    () => 0
  );
  assert.equal(item.provider, 'Freeverse');
  assert.deepEqual(item.lines, ['A line', 'Another line']);
});

test('routes Deep Space through the NASA image library and chooses a bounded rendition', async () => {
  const fetchFn = async (url) => {
    if (url.includes('/search?')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ collection: { items: [{ data: [{
          nasa_id: 'W49B',
          media_type: 'image',
          title: 'Supernova remnant W49B',
          description: 'A supernova remnant in deep space',
          date_created: '2024-01-02'
        }] }] } })
      };
    }
    assert.match(url, /images-api\.nasa\.gov\/asset\/W49B$/);
    return {
      ok: true,
      status: 200,
      json: async () => ({ collection: { items: [
        { href: 'https://images-assets.nasa.gov/image/W49B~orig.jpg' },
        { href: 'https://images-assets.nasa.gov/image/W49B~large.jpg' }
      ] } })
    };
  };

  const item = await getReplacement(
    { streams: { ai: 'deep-space' } },
    'ai',
    fetchFn,
    () => 0
  );
  assert.equal(item.provider, 'Deep Space');
  assert.match(item.assetUrl, /~large\.jpg$/);
});

test('routes Modern Art through the experimental WikiArt mirror', async () => {
  const fetchFn = async (url) => {
    assert.match(url, /datasets-server\.huggingface\.co\/filter/);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        features: [
          { name: 'artist', type: { names: ['Artist'] } },
          { name: 'genre', type: { names: ['portrait'] } },
          { name: 'style', type: { names: ['Pop_Art'] } }
        ],
        rows: [{ row: {
          artist: 0,
          genre: 0,
          style: 0,
          image: { src: 'https://datasets-server.huggingface.co/image.jpg' }
        } }]
      })
    };
  };

  const item = await getReplacement(
    { streams: { ai: 'modern-art' } },
    'ai',
    fetchFn,
    () => 0
  );
  assert.equal(item.provider, 'Modern Art');
});

test('loads the New Yorker cartoons stream from the NextML research corpus', async () => {
  const fetchFn = async (url) => {
    assert.match(url, /datasets-server\.huggingface\.co\/filter/);
    assert.match(url, /where=%22contest_number%22%3E%3D508/);
    return {
      ok: true,
      status: 200,
      json: async () => ({ rows: [{ row: {
        contest_number: 556,
        image: { src: 'https://datasets-server.huggingface.co/cached-assets/cartoon.jpg' },
        caption_choices: ['First', 'Winner'],
        label: 'B',
        instance_id: 'row'
      } }] })
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
