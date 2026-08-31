// Verifies the held-venue claim fixes against SERVED HTML, not source.
//
// Sampled, not exhaustive: 3 held buildings and 3 verified ones, 6 requests.
// A source grep cannot see what a shared component actually emits, and the
// string under test reaches TWO consumers (meta description and the
// StadiumOrArena JSON-LD), so both are asserted separately from served bytes.
//
// Usage: node audit/verify-held-venue-claims.mjs <origin>
//   e.g. node audit/verify-held-venue-claims.mjs https://promonight-web-git-...vercel.app
import { setTimeout as sleep } from 'node:timers/promises';

const ORIGIN = process.argv[2];
if (!ORIGIN) {
  console.error('usage: node audit/verify-held-venue-claims.mjs <origin>');
  process.exit(2);
}

const HELD = ['michigan-stadium', 'sanford-stadium', 'autzen-stadium'];
const VERIFIED = ['american-family-field', 'allianz-field', 'beaver-stadium'];

// The claim this whole change exists to remove, plus the sibling words the
// replacement must also avoid.
const CLAIM = 'Gameday details verified and updated for the 2026 season';
const FORBIDDEN_IN_HELD_DESC = ['verified', 'updated', 'confirmed', 'current'];

// Affiliate CTA fingerprints as they appear in served markup. Impact and
// Ticketmaster links are the monetised surfaces; SpotHero and Expedia were
// already gated on verified and are checked so a regression there is visible.
const AFFILIATE_MARKERS = [
  { name: 'Ticketmaster', re: /ticketmaster/i },
  { name: 'Fanatics', re: /fanatics/i },
  { name: 'SpotHero', re: /spothero/i },
  { name: 'Expedia', re: /expedia/i },
];

let failures = 0;
const results = [];

function check(ok, label, detail) {
  if (!ok) failures += 1;
  results.push({ ok, label, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `\n        ${detail}` : ''}`);
}

function metaDescription(html) {
  const m = html.match(/<meta name="description" content="([^"]*)"/);
  return m ? m[1] : null;
}

function jsonLdBlocks(html) {
  const out = [];
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')));
    } catch {
      out.push({ __unparseable: m[1].slice(0, 200) });
    }
  }
  return out;
}

async function get(path) {
  // Cache-busting query param. On a fresh preview deployment every path is a
  // cold MISS anyway; on an aliased production host the query string is NOT
  // part of the cache key, which is why the x-vercel-cache value is reported
  // rather than assumed.
  const url = `${ORIGIN}${path}?cb=hvc${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(url, { headers: { 'user-agent': 'promonight-verify/1' } });
  const html = await res.text();
  return {
    status: res.status,
    cache: res.headers.get('x-vercel-cache') ?? 'n/a',
    id: res.headers.get('x-vercel-id') ?? 'n/a',
    html,
  };
}

console.log(`origin: ${ORIGIN}`);
console.log(`when:   ${new Date().toISOString()}\n`);

console.log('--- HELD BUILDINGS: no verification claim, no affiliate CTA ---');
for (const slug of HELD) {
  const r = await get(`/venues/${slug}`);
  console.log(`\n[${slug}] ${r.status} cache=${r.cache} id=${r.id}`);
  check(r.status === 200, `${slug}: 200`, `got ${r.status}`);

  // 1. The exact retired string appears nowhere in the markup at all.
  check(!r.html.includes(CLAIM), `${slug}: retired claim absent from full markup`);

  // 2. The meta description asserts nothing about verification.
  const desc = metaDescription(r.html);
  check(desc !== null, `${slug}: has a meta description`, desc === null ? 'none found' : '');
  for (const w of FORBIDDEN_IN_HELD_DESC) {
    check(
      desc !== null && !new RegExp(w, 'i').test(desc),
      `${slug}: meta description does not assert "${w}"`,
      desc ?? '',
    );
  }

  // 3. The StadiumOrArena JSON-LD description carries the same clean value.
  const place = jsonLdBlocks(r.html).find((b) => b && b['@type'] === 'StadiumOrArena');
  check(!!place, `${slug}: emits StadiumOrArena JSON-LD`);
  if (place) {
    const jd = String(place.description ?? '');
    for (const w of FORBIDDEN_IN_HELD_DESC) {
      check(!new RegExp(w, 'i').test(jd), `${slug}: JSON-LD description does not assert "${w}"`, jd);
    }
    check(jd === desc, `${slug}: JSON-LD description and meta description agree`, `meta=${desc}\n        jsonld=${jd}`);
  }

  // 4. No affiliate CTA on a building we admit we have no data for.
  for (const a of AFFILIATE_MARKERS) {
    check(!a.re.test(r.html), `${slug}: no ${a.name} CTA`);
  }

  // 5. The held notice and its contact affordance are still there.
  check(r.html.includes('still confirming gameday details'), `${slug}: held notice present`);
  check(r.html.includes('mailto:hello@getpromonight.com'), `${slug}: contact affordance present`);

  await sleep(250);
}

console.log('\n--- VERIFIED BUILDINGS: untouched ---');
for (const slug of VERIFIED) {
  const r = await get(`/venues/${slug}`);
  console.log(`\n[${slug}] ${r.status} cache=${r.cache} id=${r.id}`);
  check(r.status === 200, `${slug}: 200`, `got ${r.status}`);
  check(!r.html.includes(CLAIM), `${slug}: retired claim absent`);
  check(!r.html.includes('still confirming gameday details'), `${slug}: not showing the held notice`);
  // The two monetised CTAs must still render here. This is the regression
  // guard: a gate that silences everything is not a fix.
  for (const a of AFFILIATE_MARKERS.filter((x) => x.name === 'Ticketmaster' || x.name === 'Fanatics')) {
    check(a.re.test(r.html), `${slug}: ${a.name} CTA still present`);
  }
  await sleep(250);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} assertions passed`);
process.exit(failures === 0 ? 0 : 1);
