import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFreeverseReplacement,
  buildFarSideReplacement,
  buildGarrosGalleryReplacement,
  buildHideReplacement,
  buildHidePromotedReplacement,
  buildHideSuggestedReplacement,
  buildNationalGalleryReplacement,
  buildModernArtReplacement,
  buildNasaDeepSpaceReplacement,
  buildNextMlReplacement,
  buildPaintingClassicsReplacement,
  buildRijksmuseumReplacement,
  getReplacement,
  normalizeCard,
  parseGarrosGallery,
  parseNgaPublishedImagesChunk,
  parseNewYorkerFeed,
  parseSallyBakingFeed,
  PROVIDER_REGISTRY,
  STREAM_REGISTRY
} from '../src/background/providers.mjs';

test('normalizes provider cards to one stable shape', () => {
  const item = normalizeCard({
    kind: 'image',
    id: 'example',
    assetUrl: 'https://example.com/image.jpg',
    title: 'Example',
    provider: 'Example provider',
    rights: 'CC0',
    caption: 'Optional metadata'
  });

  assert.deepEqual(item, {
    kind: 'image',
    id: 'example',
    title: 'Example',
    creator: '',
    date: '',
    location: '',
    sourceUrl: '',
    rights: 'CC0',
    credit: '',
    provider: 'Example provider',
    assetUrl: 'https://example.com/image.jpg',
    caption: 'Optional metadata'
  });
});

test('parses and builds an open-access National Gallery image row', () => {
  const csv = [
    'uuid,iiifurl,iiifthumburl,viewtype,sequence,width,height,maxpixels,openaccess,created,modified,depictstmsobjectid,assistivetext',
    '00007f61-4922-417b-8f27-893ea328206c,https://api.nga.gov/iiif/00007f61-4922-417b-8f27-893ea328206c,"https://api.nga.gov/iiif/00007f61-4922-417b-8f27-893ea328206c/full/!200,200/0/default.jpg",Image,1,1000,800,0,1,2020-01-01,2020-01-02,17387,"Study of a landscape, open access."'
  ].join('\n');
  const rows = parseNgaPublishedImagesChunk(csv);
  const item = buildNationalGalleryReplacement(rows[0]);

  assert.equal(rows.length, 1);
  assert.equal(item.provider, 'National Gallery of Art');
  assert.equal(item.rights, 'CC0');
  assert.match(item.assetUrl, /api\.nga\.gov\/iiif\/00007f61/);
  assert.match(item.sourceUrl, /art-object-page\.17387/);
});

test('builds a public-domain Rijksmuseum IIIF image', () => {
  const item = buildRijksmuseumReplacement(
    {
      id: 'https://id.rijksmuseum.nl/200100988',
      identified_by: [
        { type: 'Name', content: 'The Night Watch' },
        { type: 'Identifier', content: 'SK-C-5' }
      ],
      produced_by: {
        part: [{ carried_out_by: [{ notation: [{ '@language': 'en', '@value': 'Rembrandt van Rijn' }] }] }],
        timespan: { identified_by: [{ content: '1642' }] }
      }
    },
    { subject_to: [{ id: 'https://creativecommons.org/publicdomain/zero/1.0/' }] },
    { access_point: [{ id: 'https://iiif.micr.io/mPymb/full/max/0/default.jpg' }] }
  );

  assert.equal(item.provider, 'Rijksmuseum');
  assert.equal(item.rights, 'Public domain');
  assert.equal(item.creator, 'Rembrandt van Rijn');
  assert.equal(item.title, 'The Night Watch');
  assert.match(item.assetUrl, /full\/960,/);
  assert.match(item.sourceUrl, /SK-C-5/);
});

test('parses and labels Garross Gallery records as research link-backs', () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    mainEntity: { itemListElement: [{ item: {
      name: '2026 poster',
      creator: { name: 'Example artist' },
      dateCreated: '2026',
      image: 'https://smlneelkaujgtwoe.public.blob.vercel-storage.com/posters/rg2026.webp',
      url: 'https://www.garros.gallery/poster/2026'
    } }] }
  })}</script>`;
  const [record] = parseGarrosGallery(html);
  const item = buildGarrosGalleryReplacement(record);

  assert.equal(item.provider, '🎾 Garross Gallery');
  assert.equal(item.rights, 'Copyrighted · research link-back');
  assert.equal(item.creator, 'Example artist');
  assert.match(item.sourceUrl, /garros\.gallery\/poster\/2026/);
});

test('removes retired feeds and keeps Surprise me rights-safe', () => {
  assert.deepEqual(STREAM_REGISTRY['surprise-me'].providerIds, [
    'painting-classics',
    'freeverse',
    'deep-space'
  ]);
  for (const stream of [
    'art-2',
    'newyorker-latest',
    'newyorker-cartoons',
    'far-side'
  ]) {
    assert.equal(STREAM_REGISTRY[stream], undefined);
  }
  assert.ok(
    STREAM_REGISTRY['surprise-me'].providerIds.every(
      (providerId) => PROVIDER_REGISTRY[providerId].rightsSafe
    )
  );
  assert.equal(PROVIDER_REGISTRY['national-gallery'], undefined);
  assert.equal(PROVIDER_REGISTRY.rijksmuseum, undefined);
  assert.equal(PROVIDER_REGISTRY['newyorker-latest'], undefined);
  assert.equal(PROVIDER_REGISTRY['newyorker-cartoons'], undefined);
  assert.equal(PROVIDER_REGISTRY['far-side'], undefined);
  assert.equal(PROVIDER_REGISTRY['garros-gallery'].rightsSafe, false);
  for (const provider of Object.values(PROVIDER_REGISTRY)) {
    assert.equal(typeof provider.fetch, 'function');
  }
});

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

test('builds an explicitly labeled Far Side research replacement', () => {
  const item = buildFarSideReplacement(
    {
      image: {
        src: 'https://datasets-server.huggingface.co/cached-assets/farside.jpg'
      },
      text: 'a person with an old tree and another with a ladder'
    },
    12
  );

  assert.equal(item.kind, 'image');
  assert.equal(item.id, 'far-side-12');
  assert.equal(item.provider, 'Far Side (experimental)');
  assert.equal(item.creator, 'Gary Larson');
  assert.equal(item.rights, 'Copyrighted · noncommercial dataset');
  assert.equal(item.caption, 'a person with an old tree and another with a ladder');
});

test('builds the three compact hide replacement notices', () => {
  const ai = buildHideReplacement();
  const promoted = buildHidePromotedReplacement();
  const suggested = buildHideSuggestedReplacement();

  assert.equal(ai.kind, 'notice');
  assert.equal(ai.title, '☢️ AI post hidden');
  assert.equal(promoted.title, '💸 Promoted post hidden');
  assert.equal(suggested.title, '🤓 Suggested post hidden');
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

test('parses Sally Baking muffin and dessert RSS items as recipe link-backs', () => {
  const xml = `<rss><channel><item>
    <title><![CDATA[Blackberry Lemon Poppy Seed Muffins]]></title>
    <link>https://sallysbakingaddiction.com/blackberry-lemon-poppy-seed-muffins/</link>
    <dc:creator><![CDATA[Sally McKenney]]></dc:creator>
    <category><![CDATA[Muffins]]></category>
    <description><![CDATA[<img src="https://sallysbakingaddiction.com/wp-content/uploads/2026/07/muffins.jpg" alt="muffins" /><p>Bakery-style muffins.</p>]]></description>
  </item></channel></rss>`;

  const [item] = parseSallyBakingFeed(xml);
  assert.equal(item.provider, "🧁 Sally's Baking");
  assert.equal(item.title, 'Blackberry Lemon Poppy Seed Muffins');
  assert.equal(item.creator, 'Sally McKenney');
  assert.equal(item.location, 'Muffins');
  assert.equal(item.rights, 'Copyrighted · recipe link-back');
  assert.match(item.assetUrl, /sallysbakingaddiction\.com\/wp-content/);
  assert.match(item.sourceUrl, /blackberry-lemon-poppy-seed-muffins/);
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

test('routes Garross Gallery through its explicit research stream', async () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    mainEntity: { itemListElement: [{ item: {
      name: '2026 poster',
      creator: { name: 'Example artist' },
      dateCreated: '2026',
      image: 'https://smlneelkaujgtwoe.public.blob.vercel-storage.com/posters/rg2026.webp',
      url: 'https://www.garros.gallery/poster/2026'
    } }] }
  })}</script>`;
  const item = await getReplacement(
    { streams: { ai: 'garros-gallery' } },
    'ai',
    async (url) => {
      assert.equal(url, 'https://www.garros.gallery/');
      return { ok: true, status: 200, text: async () => html };
    },
    () => 0
  );
  assert.equal(item.provider, '🎾 Garross Gallery');
});

test('routes Baking Recipes through the muffin or dessert RSS feeds', async () => {
  const xml = `<rss><channel><item>
    <title>Chocolate Chip Muffins</title>
    <link>https://sallysbakingaddiction.com/chocolate-chip-muffins/</link>
    <category>Muffins</category>
    <description><![CDATA[<img src="https://sallysbakingaddiction.com/wp-content/uploads/muffins.jpg" />]]></description>
  </item></channel></rss>`;
  const item = await getReplacement(
    { streams: { ai: 'baking-recipes' } },
    'ai',
    async (url) => {
      assert.match(url, /sallysbakingaddiction\.com\/category\/(?:breakfast-treats\/muffins|desserts)\/feed/);
      return { ok: true, status: 200, text: async () => xml };
    },
    () => 0
  );
  assert.equal(item.provider, "🧁 Sally's Baking");
});

test('routes the Hide AI stream to a compact notice', async () => {
  const item = await getReplacement(
    { streams: { ai: 'hide-ai' } },
    'ai',
    async () => {
      throw new Error('Hide AI should not request a remote provider');
    },
    () => 0
  );

  assert.equal(item.kind, 'notice');
  assert.equal(item.title, '☢️ AI post hidden');
});

test('routes like and comment cleanup streams to their requested compact notices', async () => {
  const like = await getReplacement({ streams: { ai: 'hide-liked' } }, 'ai', async () => {
    throw new Error('Like cleanup should not request a remote provider');
  });
  const comment = await getReplacement({ streams: { ai: 'hide-commented' } }, 'ai', async () => {
    throw new Error('Comment cleanup should not request a remote provider');
  });

  assert.equal(like.kind, 'notice');
  assert.equal(like.title, '💔 Like hidden');
  assert.equal(comment.kind, 'notice');
  assert.equal(comment.title, '💬 Comment hidden');
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
