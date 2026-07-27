// Unit tests for the server-truth traffic classifier.
//
// FIXTURE PROVENANCE. Every string tagged OBSERVED below is a verbatim real
// user agent pulled read-only from the ai_crawler_hits Firestore collection
// (18,198 documents, 32 distinct user agents, pulled 2026-07-27). Strings
// tagged CANONICAL are the vendors' published user agents, used only where the
// legacy 8-entry detectBot() list never matched the crawler and therefore
// never logged it: Googlebot, every SEO tool, and every link unfurler are
// absent from our own data precisely because they were never detected. Those
// gaps are what this classifier closes, so they have to be tested against
// published strings rather than observed ones.
//
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert';
import {
  CLASSIFIER_VERSION,
  classifyRequestType,
  classifyTraffic,
} from '../traffic-classifier';

// ── ai_crawler fixtures ───────────────────────────────────────────────────

const AI_CRAWLER_UAS: Array<[label: string, ua: string]> = [
  // OBSERVED, 8,185 hits, the single most common agent on the site.
  [
    'ChatGPT-User (observed, most common)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  ],
  // OBSERVED, 19 hits, parenthesized variant.
  [
    'ChatGPT-User (observed, variant)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)',
  ],
  // OBSERVED, 256 hits.
  [
    'ClaudeBot (observed)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  ],
  // OBSERVED, 1 hit. Bare product token, no Mozilla prefix.
  ['ClaudeBot (observed, bare)', 'ClaudeBot/1.0'],
  // OBSERVED, 174 hits.
  [
    'GPTBot 1.3 (observed)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.3; +https://openai.com/gptbot)',
  ],
  // OBSERVED, 83 hits.
  [
    'GPTBot 1.4 (observed)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.4; +https://openai.com/gptbot)',
  ],
  // OBSERVED, 943 hits.
  [
    'PerplexityBot (observed)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  ],
  // OBSERVED, 1 hit, newer docs URL.
  [
    'PerplexityBot (observed, docs URL)',
    'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://docs.perplexity.ai/guides/bots)',
  ],
  // OBSERVED, 50 hits. Bare token.
  ['GoogleOther (observed, bare)', 'GoogleOther'],
  // OBSERVED, 93 hits. Note this one carries Chrome AND Mobile Safari, so it
  // would read as an ordinary phone browser without the GoogleOther token.
  [
    'GoogleOther (observed, Chrome mobile shell)',
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.96 Mobile Safari/537.36 (compatible; GoogleOther)',
  ],
  // CANONICAL. Applebot is the ordering regression guard, tested again on its
  // own below.
  [
    'Applebot (canonical)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
  ],
  // CANONICAL, never observed here.
  ['Bytespider (canonical)', 'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)'],
  ['Amazonbot (canonical)', 'Mozilla/5.0 (Linux; like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Amazonbot/0.1'],
  ['meta-externalagent (canonical)', 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)'],
  ['OAI-SearchBot (canonical)', 'Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)'],
  ['Claude-User (canonical)', 'Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)'],
  ['Diffbot (canonical)', 'Mozilla/5.0 (compatible; Diffbot/0.1; +http://www.diffbot.com)'],
  ['YouBot (canonical)', 'Mozilla/5.0 (compatible; YouBot (+http://www.you.com))'],
];

test('ai_crawler: every fixture classifies as ai_crawler', () => {
  for (const [label, ua] of AI_CRAWLER_UAS) {
    assert.strictEqual(classifyTraffic(ua), 'ai_crawler', `expected ai_crawler for ${label}`);
  }
  assert.ok(AI_CRAWLER_UAS.length >= 3, 'need at least three ai_crawler fixtures');
});

// ── search_crawler fixtures ───────────────────────────────────────────────

const SEARCH_CRAWLER_UAS: Array<[label: string, ua: string]> = [
  // OBSERVED, 7,427 hits, the most common bingbot form on the site.
  [
    'bingbot (observed, most common)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
  ],
  // OBSERVED, 393 hits, classic short form.
  ['bingbot (observed, short)', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  // OBSERVED, 3 hits. Capital B. Guards against a case-sensitive pattern.
  ['Bingbot (observed, capital B)', 'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  // OBSERVED, 1 hit. Malformed: double space, missing the leading plus.
  ['bingbot (observed, malformed)', 'Mozilla/5.0 (compatible; bingbot/2.0  http://www.bing.com/bingbot.htm)'],
  // OBSERVED, 10 hits. Mobile bingbot wearing a full Chrome mobile shell.
  [
    'bingbot (observed, mobile shell)',
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  ],
  // CANONICAL. Googlebot variants, none of which appear in our data because
  // the legacy list never matched them. See the Googlebot-specific test below.
  ['Googlebot-Image (canonical)', 'Googlebot-Image/1.0'],
  ['Googlebot-News (canonical)', 'Mozilla/5.0 (compatible; Googlebot-News; +http://www.google.com/bot.html)'],
  ['Googlebot-Video (canonical)', 'Googlebot-Video/1.0'],
  ['DuckDuckBot (canonical)', 'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)'],
  ['YandexBot (canonical)', 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)'],
  ['Baiduspider (canonical)', 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)'],
  ['Slurp (canonical)', 'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)'],
  ['PetalBot (canonical)', 'Mozilla/5.0 (compatible; PetalBot; +https://webmaster.petalsearch.com/site/petalbot)'],
];

test('search_crawler: every fixture classifies as search_crawler', () => {
  for (const [label, ua] of SEARCH_CRAWLER_UAS) {
    assert.strictEqual(classifyTraffic(ua), 'search_crawler', `expected search_crawler for ${label}`);
  }
  assert.ok(SEARCH_CRAWLER_UAS.length >= 3, 'need at least three search_crawler fixtures');
});

// ── seo_tool fixtures ─────────────────────────────────────────────────────
// All CANONICAL. Zero SEO-tool hits exist in ai_crawler_hits because the
// legacy list contained no SEO-tool pattern, so this traffic has been counted
// as human for the life of the site.

const SEO_TOOL_UAS: Array<[label: string, ua: string]> = [
  ['AhrefsBot', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
  ['SemrushBot', 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)'],
  ['DotBot', 'Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot)'],
  ['MJ12bot', 'Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)'],
  ['BLEXBot', 'Mozilla/5.0 (compatible; BLEXBot/1.0; +http://webmeup-crawler.com/)'],
  ['DataForSeoBot', 'Mozilla/5.0 (compatible; DataForSeoBot/1.0; +https://dataforseo.com/dataforseo-bot)'],
  // Contains the word "Spider", so it would land in unknown if the generic
  // pattern were tested before seo_tool. Ordering guard.
  ['Screaming Frog', 'Screaming Frog SEO Spider/19.2'],
  ['SerpstatBot', 'SerpstatBot/2.1 (+http://serpstatbot.com/)'],
  ['Barkrowler', 'Mozilla/5.0 (compatible; Barkrowler/0.9; +https://babbar.tech/crawler)'],
];

test('seo_tool: every fixture classifies as seo_tool', () => {
  for (const [label, ua] of SEO_TOOL_UAS) {
    assert.strictEqual(classifyTraffic(ua), 'seo_tool', `expected seo_tool for ${label}`);
  }
  assert.ok(SEO_TOOL_UAS.length >= 3, 'need at least three seo_tool fixtures');
});

// ── unknown fixtures ──────────────────────────────────────────────────────

const UNKNOWN_UAS: Array<[label: string, ua: string]> = [
  ['generic bot', 'SomeRandomBot/1.0'],
  ['generic crawler', 'my-internal-crawler/0.3'],
  ['generic spider', 'NotoriousSpider/2'],
  ['generic scraper', 'price-scraper/1.0'],
  ['curl', 'curl/8.4.0'],
  ['wget', 'Wget/1.21.3'],
  ['python-requests', 'python-requests/2.31.0'],
  ['axios', 'axios/1.6.2'],
  ['Go-http-client', 'Go-http-client/2.0'],
  // Link unfurlers. Neither human nor crawler, but definitely not human.
  ['facebookexternalhit', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
  ['Twitterbot', 'Twitterbot/1.0'],
  ['Slackbot', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
  ['LinkedInBot', 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Jakarta Commons-HttpClient/3.1 +http://www.linkedin.com)'],
  ['WhatsApp', 'WhatsApp/2.23.20.0'],
  ['TelegramBot', 'TelegramBot (like TwitterBot)'],
  // v2. Default-UA headless browsers. Automated, but not attributable to a
  // named agent, which is what unknown is for.
  [
    'HeadlessChrome (Puppeteer default)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/128.0.0.0 Safari/537.36',
  ],
];

test('unknown: every fixture classifies as unknown', () => {
  for (const [label, ua] of UNKNOWN_UAS) {
    assert.strictEqual(classifyTraffic(ua), 'unknown', `expected unknown for ${label}`);
  }
  assert.ok(UNKNOWN_UAS.length >= 3, 'need at least three unknown fixtures');
});

test('unknown: null and empty user agents are unknown, never human', () => {
  // Absence of a UA is itself a signal. Every real browser sends one.
  assert.strictEqual(classifyTraffic(null), 'unknown', 'null UA');
  assert.strictEqual(classifyTraffic(''), 'unknown', 'empty-string UA');
  assert.strictEqual(classifyTraffic('   '), 'unknown', 'whitespace-only UA');
  assert.strictEqual(classifyTraffic('\t\n'), 'unknown', 'tab and newline only UA');
});

// ── human fixtures ────────────────────────────────────────────────────────

const HUMAN_UAS: Array<[label: string, ua: string]> = [
  [
    'desktop Chrome on macOS',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  ],
  [
    'desktop Chrome on Windows',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  ],
  [
    'mobile Safari on iPhone',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ],
  [
    'mobile Chrome on Android',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  ],
  [
    'desktop Safari on macOS',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  ],
  [
    'Firefox on Windows',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
  ],
  // OBSERVED, 7 hits. The Gemini iOS app's in-app WebView, i.e. a real person
  // tapping a link inside the Gemini app. The legacy detectBot() list matched
  // this on a bare /Gemini/i pattern and mislabeled it a crawler. This
  // classifier deliberately calls it human, which is the correct read: an
  // iPhone WebView is a person, not a fetcher.
  [
    'GeminiiOS in-app WebView (observed, deliberately human)',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 GoogleWv/1.0 (WKWebView) GeminiiOS/1.2026.2470603',
  ],
];

test('human: ordinary browsers classify as human', () => {
  for (const [label, ua] of HUMAN_UAS) {
    assert.strictEqual(classifyTraffic(ua), 'human', `expected human for ${label}`);
  }
});

test('human: AppleWebKit does not trip the Applebot pattern', () => {
  // Every Safari and Chrome UA contains "AppleWebKit". If the Applebot
  // pattern were ever loosened to /Apple/i, essentially all human traffic
  // would be reclassified as ai_crawler. This is the guard for that.
  const safari =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  assert.ok(safari.includes('AppleWebKit'), 'fixture must contain AppleWebKit');
  assert.strictEqual(classifyTraffic(safari), 'human');
});

test('human: headless Chrome with an OVERRIDDEN clean UA is human (KNOWN AND EXPECTED)', () => {
  // THIS IS NOT A BUG. Playwright and Puppeteer can be told to present a user
  // agent byte-identical to real Chrome. No user-agent list can separate those
  // from a person, so they land in `human` permanently. This is the hard floor
  // on precision and the reason the human count is documented as an UPPER
  // BOUND rather than an exact human number. See note 2 in the module header.
  //
  // Closing this would require a different signal entirely: TLS
  // fingerprinting, behavioral analysis, or an interactive challenge. None of
  // those are in scope for the counter.
  const cleanHeadless =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  assert.strictEqual(
    classifyTraffic(cleanHeadless),
    'human',
    'an overridden-UA headless browser is indistinguishable from a human by UA alone',
  );
});

test('unknown: DEFAULT-UA headless Chrome is unknown (v2 behavior)', () => {
  // The other half of the automation problem, and the catchable half. Puppeteer
  // and Playwright chromium both advertise "HeadlessChrome" unless the operator
  // overrides the UA, so the default case is detectable and v2 detects it.
  //
  // It is classified `unknown` rather than a crawler class deliberately: the
  // token proves the client is automated but says nothing about who is driving
  // it. v1 classified these as human; that was the reason for the v2 bump.
  const puppeteerDefault =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/128.0.0.0 Safari/537.36';
  assert.strictEqual(classifyTraffic(puppeteerDefault), 'unknown');

  const playwrightLinux =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/124.0.6367.207 Safari/537.36';
  assert.strictEqual(classifyTraffic(playwrightLinux), 'unknown');

  // Case-insensitive, since the token's casing is not guaranteed downstream.
  assert.strictEqual(
    classifyTraffic('Mozilla/5.0 headlesschrome/120.0.0.0 Safari/537.36'),
    'unknown',
  );

  // And the guard that matters: it must NOT drag ordinary Chrome along with it.
  assert.strictEqual(
    classifyTraffic(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    ),
    'human',
    'plain Chrome must stay human',
  );
});

// ── ordering regressions ──────────────────────────────────────────────────

test('ordering: Applebot is ai_crawler, not unknown', () => {
  // Applebot contains "bot", so if the generic pattern ran before the
  // ai_crawler pattern it would be filed as unknown. Explicit guard on the
  // class evaluation order.
  const applebot =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)';
  assert.strictEqual(classifyTraffic(applebot), 'ai_crawler');
  assert.notStrictEqual(classifyTraffic(applebot), 'unknown');
});

test('ordering: Googlebot/2.1 is search_crawler', () => {
  // THE LARGEST CORRECTNESS FIX IN THIS BUILD. The legacy 8-entry detectBot()
  // list in middleware.ts matched only /Googlebot-(News|Image|Video)?.*Gemini/,
  // /GoogleOther/ and /Gemini/, so plain Googlebot matched NOTHING and was
  // counted as a human visitor. Zero Googlebot hits exist in ai_crawler_hits
  // for exactly that reason, despite ~35,500 monthly Google impressions.
  const desktop = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  assert.strictEqual(classifyTraffic(desktop), 'search_crawler', 'desktop Googlebot');

  // The smartphone Googlebot wears a full Chrome mobile shell, so it reads as
  // an ordinary phone right up to the trailing token.
  const smartphone =
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  assert.strictEqual(classifyTraffic(smartphone), 'search_crawler', 'smartphone Googlebot');

  // Bare token, and the lowercase form some proxies emit.
  assert.strictEqual(classifyTraffic('Googlebot/2.1'), 'search_crawler', 'bare Googlebot');
  assert.strictEqual(classifyTraffic('googlebot/2.1'), 'search_crawler', 'lowercase googlebot');
});

test('ordering: GoogleOther is ai_crawler, and does not leak into search_crawler', () => {
  // Both classes contain Google-prefixed tokens. ai_crawler runs first, so
  // GoogleOther must land there. If the search_crawler pattern were ever
  // loosened to /Google/i this test fails.
  assert.strictEqual(classifyTraffic('GoogleOther'), 'ai_crawler');
});

test('ordering: Screaming Frog is seo_tool despite containing Spider', () => {
  assert.strictEqual(classifyTraffic('Screaming Frog SEO Spider/19.2'), 'seo_tool');
});

// ── exhaustive token coverage ──────────────────────────────────────────────
// The realistic fixtures above do not exercise every approved token: eight of
// them (Claude-SearchBot, Perplexity-User, Google-CloudVertexBot, cohere-ai,
// Timpibot, Omgilibot, Sogou, ZoominfoBot) have no realistic fixture, so a typo
// in one of those alternatives would ship undetected. This table asserts every
// approved token individually, as a bare product token, against its intended
// class. It is the wiring check; the fixtures above are the realism check.

const APPROVED_TOKENS: Array<[token: string, expected: string]> = [
  ['GPTBot', 'ai_crawler'],
  ['ChatGPT-User', 'ai_crawler'],
  ['OAI-SearchBot', 'ai_crawler'],
  ['ClaudeBot', 'ai_crawler'],
  ['Claude-User', 'ai_crawler'],
  ['Claude-SearchBot', 'ai_crawler'],
  ['PerplexityBot', 'ai_crawler'],
  ['Perplexity-User', 'ai_crawler'],
  ['Bytespider', 'ai_crawler'],
  ['Amazonbot', 'ai_crawler'],
  ['meta-externalagent', 'ai_crawler'],
  ['Applebot', 'ai_crawler'],
  ['GoogleOther', 'ai_crawler'],
  ['Google-CloudVertexBot', 'ai_crawler'],
  ['cohere-ai', 'ai_crawler'],
  ['Diffbot', 'ai_crawler'],
  ['Timpibot', 'ai_crawler'],
  ['Omgilibot', 'ai_crawler'],
  ['YouBot', 'ai_crawler'],
  ['Googlebot', 'search_crawler'],
  ['Googlebot-Image', 'search_crawler'],
  ['Googlebot-News', 'search_crawler'],
  ['Googlebot-Video', 'search_crawler'],
  ['bingbot', 'search_crawler'],
  ['Slurp', 'search_crawler'],
  ['DuckDuckBot', 'search_crawler'],
  ['YandexBot', 'search_crawler'],
  ['Baiduspider', 'search_crawler'],
  ['Sogou', 'search_crawler'],
  ['PetalBot', 'search_crawler'],
  ['AhrefsBot', 'seo_tool'],
  ['SemrushBot', 'seo_tool'],
  ['DotBot', 'seo_tool'],
  ['MJ12bot', 'seo_tool'],
  ['BLEXBot', 'seo_tool'],
  ['DataForSeoBot', 'seo_tool'],
  ['Screaming Frog', 'seo_tool'],
  ['SerpstatBot', 'seo_tool'],
  ['ZoominfoBot', 'seo_tool'],
  ['Barkrowler', 'seo_tool'],
];

test('coverage: every approved token classifies into its intended class', () => {
  for (const [token, expected] of APPROVED_TOKENS) {
    assert.strictEqual(
      classifyTraffic(token),
      expected,
      `bare token "${token}" should be ${expected}`,
    );
    // Also inside a realistic wrapper, since most crawlers embed the token in
    // a Mozilla-prefixed string rather than sending it bare.
    const wrapped = `Mozilla/5.0 (compatible; ${token}/1.0; +http://example.com/bot)`;
    assert.strictEqual(
      classifyTraffic(wrapped),
      expected,
      `wrapped token "${token}" should be ${expected}`,
    );
  }
});

test('coverage: no approved token is accidentally classified as human', () => {
  // Blunt restatement of the test above, kept separate because this is the
  // failure that actually matters: a crawler counted as a human inflates the
  // number that gets quoted externally.
  for (const [token] of APPROVED_TOKENS) {
    assert.notStrictEqual(classifyTraffic(token), 'human', `"${token}" leaked into human`);
  }
});

test('coverage: every class pattern is case-insensitive', () => {
  // Regression guard on the /i flag, one class at a time. Verified to be
  // load-bearing: with only the realistic fixtures above, removing /i from the
  // ai_crawler or seo_tool pattern left the whole suite green, because every
  // one of those fixtures happens to match the exact casing in the pattern.
  // Real crawlers do vary their casing (the observed bingbot data contains both
  // "bingbot" and "Bingbot"), and a dropped flag would silently leak crawlers
  // into human, so each class is asserted in lower and upper case.
  const perClass: Array<[token: string, expected: string]> = [
    ['ClaudeBot', 'ai_crawler'],
    ['Googlebot', 'search_crawler'],
    ['AhrefsBot', 'seo_tool'],
    ['SomeRandomBot', 'unknown'],
  ];
  for (const [token, expected] of perClass) {
    assert.strictEqual(classifyTraffic(token.toLowerCase()), expected, `lowercase ${token}`);
    assert.strictEqual(classifyTraffic(token.toUpperCase()), expected, `uppercase ${token}`);
  }
});

test('classifier: no class returns a value outside the union', () => {
  const valid = new Set(['ai_crawler', 'search_crawler', 'seo_tool', 'unknown', 'human']);
  const all = [
    ...AI_CRAWLER_UAS,
    ...SEARCH_CRAWLER_UAS,
    ...SEO_TOOL_UAS,
    ...UNKNOWN_UAS,
    ...HUMAN_UAS,
  ];
  for (const [label, ua] of all) {
    assert.ok(valid.has(classifyTraffic(ua)), `out-of-union result for ${label}`);
  }
});

test('classifier: repeated calls are stable (no stateful regex lastIndex bug)', () => {
  // A regex carrying the g flag advances lastIndex between .test() calls and
  // starts alternating true/false. Ten identical calls must agree.
  const ua =
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36';
  for (let i = 0; i < 10; i++) {
    assert.strictEqual(classifyTraffic(ua), 'search_crawler', `call ${i + 1}`);
  }
  const human =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  for (let i = 0; i < 10; i++) {
    assert.strictEqual(classifyTraffic(human), 'human', `human call ${i + 1}`);
  }
});

// ── classifyRequestType ───────────────────────────────────────────────────

test('classifyRequestType: document when neither header is present', () => {
  assert.strictEqual(classifyRequestType(new Headers()), 'document');
  assert.strictEqual(
    classifyRequestType(new Headers({ accept: 'text/html', 'user-agent': 'x' })),
    'document',
  );
});

test('classifyRequestType: soft_nav on rsc alone', () => {
  assert.strictEqual(classifyRequestType(new Headers({ rsc: '1' })), 'soft_nav');
});

test('classifyRequestType: prefetch on next-router-prefetch', () => {
  assert.strictEqual(
    classifyRequestType(new Headers({ 'next-router-prefetch': '1' })),
    'prefetch',
  );
});

test('classifyRequestType: BOTH headers present is prefetch, not soft_nav', () => {
  // This is the real shape of a Next prefetch: the App Router sends rsc AND
  // next-router-prefetch together. Testing rsc first would misfile every
  // prefetch as a soft navigation and silently inflate the soft_nav bucket,
  // which is the exact drift the counter exists to make visible.
  const headers = new Headers({ rsc: '1', 'next-router-prefetch': '1' });
  assert.strictEqual(classifyRequestType(headers), 'prefetch');
});

test('classifyRequestType: browser speculation is prefetch, not document', () => {
  // Chrome and Edge omnibox preloading, Google's SERP private prefetch proxy,
  // and Firefox link prefetch all fetch pages nobody is looking at yet. They
  // arrive as full document requests with a real browser UA and NEITHER of
  // Next's router headers, so without a speculation check they would be counted
  // in human_document, which is the bucket the headline number comes from.
  assert.strictEqual(
    classifyRequestType(new Headers({ 'sec-purpose': 'prefetch' })),
    'prefetch',
    'sec-purpose: prefetch',
  );
  // Token list, so a value equality check would miss these.
  assert.strictEqual(
    classifyRequestType(new Headers({ 'sec-purpose': 'prefetch;prerender' })),
    'prefetch',
    'sec-purpose token list with prerender',
  );
  assert.strictEqual(
    classifyRequestType(new Headers({ 'sec-purpose': 'prefetch;anonymous-client-ip' })),
    'prefetch',
    'Google SERP prefetch proxy shape',
  );
  // Legacy spellings.
  assert.strictEqual(
    classifyRequestType(new Headers({ purpose: 'prefetch' })),
    'prefetch',
    'legacy Chrome Purpose header',
  );
  assert.strictEqual(
    classifyRequestType(new Headers({ 'x-moz': 'prefetch' })),
    'prefetch',
    'Firefox X-moz header',
  );
  // Case-insensitive on both the name and the value.
  assert.strictEqual(
    classifyRequestType(new Headers({ 'Sec-Purpose': 'Prefetch' })),
    'prefetch',
  );

  // And the guard that matters: an ordinary navigation must stay a document.
  assert.strictEqual(
    classifyRequestType(new Headers({ accept: 'text/html', 'sec-fetch-mode': 'navigate' })),
    'document',
    'a real navigation is still a document',
  );
  // A speculation header with an unrelated value must not trip it.
  assert.strictEqual(
    classifyRequestType(new Headers({ 'sec-purpose': 'something-else' })),
    'document',
  );
});

test('classifyRequestType: speculation wins over the Next router headers', () => {
  // A speculative fetch of a soft navigation is still nobody looking at a page.
  assert.strictEqual(
    classifyRequestType(new Headers({ 'sec-purpose': 'prefetch', rsc: '1' })),
    'prefetch',
  );
  assert.strictEqual(
    classifyRequestType(
      new Headers({ 'sec-purpose': 'prefetch', rsc: '1', 'next-router-prefetch': '1' }),
    ),
    'prefetch',
  );
});

test('classifyRequestType: header names are case-insensitive', () => {
  // Proven against a real Headers instance rather than a hand-rolled fake, so
  // the guarantee comes from the platform and not from the test.
  assert.strictEqual(classifyRequestType(new Headers({ RSC: '1' })), 'soft_nav');
  assert.strictEqual(classifyRequestType(new Headers({ Rsc: '1' })), 'soft_nav');
  assert.strictEqual(
    classifyRequestType(new Headers({ 'Next-Router-Prefetch': '1' })),
    'prefetch',
  );
  assert.strictEqual(
    classifyRequestType(new Headers({ 'NEXT-ROUTER-PREFETCH': '1' })),
    'prefetch',
  );
});

test('classifyRequestType: only the exact value "1" counts', () => {
  // Guards against a truthiness check creeping in. A header present with any
  // other value is not a prefetch signal.
  assert.strictEqual(classifyRequestType(new Headers({ 'next-router-prefetch': '0' })), 'document');
  assert.strictEqual(classifyRequestType(new Headers({ 'next-router-prefetch': 'true' })), 'document');
  assert.strictEqual(classifyRequestType(new Headers({ rsc: '0' })), 'document');
  assert.strictEqual(classifyRequestType(new Headers({ rsc: 'yes' })), 'document');
});

test('classifyRequestType: accepts any minimal getter, not just Headers', () => {
  // The parameter is a structural interface so middleware, a route handler, or
  // a plain object all satisfy it without adapters.
  const fake = { get: (name: string) => (name === 'rsc' ? '1' : null) };
  assert.strictEqual(classifyRequestType(fake), 'soft_nav');

  const undefinedReturning = { get: (_name: string) => undefined };
  assert.strictEqual(classifyRequestType(undefinedReturning), 'document');
});

// ── version stamp ─────────────────────────────────────────────────────────

test('CLASSIFIER_VERSION is a non-empty string', () => {
  // Stamped onto every counter document. Counts written under different
  // versions are not comparable, so this must never be blank.
  assert.strictEqual(typeof CLASSIFIER_VERSION, 'string');
  assert.ok(CLASSIFIER_VERSION.length > 0);
  // v2 adds the HeadlessChrome token to `unknown`. If you change a pattern,
  // bump this and add a dated row to requestCounters/_meta.
  assert.strictEqual(CLASSIFIER_VERSION, 'v2');
});
