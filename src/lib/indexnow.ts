import 'server-only';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';
const HOST = 'www.getpromonight.com';
const MAX_URLS_PER_REQUEST = 10_000;

export async function submitToIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.warn('[indexnow] INDEXNOW_KEY not set, skipping submission');
    return;
  }

  if (urls.length === 0) {
    console.log('[indexnow] no urls to submit');
    return;
  }

  for (const url of urls) {
    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      throw new Error(`[indexnow] invalid url: ${url}`);
    }
    if (host !== HOST) {
      throw new Error(`[indexnow] url host ${host} does not match ${HOST}: ${url}`);
    }
  }

  const keyLocation = `https://${HOST}/${key}.txt`;
  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += MAX_URLS_PER_REQUEST) {
    chunks.push(urls.slice(i, i + MAX_URLS_PER_REQUEST));
  }

  for (const [i, chunk] of chunks.entries()) {
    const body = {
      host: HOST,
      key,
      keyLocation,
      urlList: chunk,
    };
    try {
      const res = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const chunkLabel = chunks.length > 1 ? ` (chunk ${i + 1}/${chunks.length})` : '';
      if (res.ok) {
        console.log(`[indexnow] submitted ${chunk.length} urls${chunkLabel}: ${res.status}`);
      } else {
        const text = await res.text().catch(() => '');
        console.warn(
          `[indexnow] submission failed${chunkLabel}: ${res.status} ${res.statusText} ${text}`,
        );
      }
    } catch (err) {
      console.warn(`[indexnow] network error on chunk ${i + 1}/${chunks.length}:`, err);
    }
  }
}
