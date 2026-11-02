// TrackedAppLink puts rel="nofollow" on /download?src= links in both of its
// render branches (chore/bot-firewall, 2026-11-02). The team card renders the
// plain <a>, the promo page "Remind me" also renders the plain <a>; next/link
// is covered so a future caller without plainAnchor gets the same rel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrackedAppLink } from '../analytics-events';
import { appStoreUrl, downloadHref, promoDownloadHref } from '@/lib/app-link';

const relOf = (html: string) => /\srel="([^"]*)"/.exec(html)?.[1];

function render(href: string, plainAnchor: boolean, rel?: string) {
  return renderToStaticMarkup(
    <TrackedAppLink href={href} platform="unknown" section="s" page="p" plainAnchor={plainAnchor} rel={rel}>
      x
    </TrackedAppLink>,
  );
}

for (const plainAnchor of [true, false]) {
  const branch = plainAnchor ? 'plain <a>' : 'next/link';

  test(`${branch}: both /download?src= shapes render rel="nofollow"`, () => {
    for (const href of [downloadHref('minnesota-twins'), promoDownloadHref('dallas-stars', '681fc85299a82ba4', 'esa-lindell-bobblehead')]) {
      const html = render(href, plainAnchor);
      assert.equal(relOf(html), 'nofollow', html);
    }
  });

  test(`${branch}: bare /download has no rel; a store link keeps noopener only`, () => {
    assert.equal(relOf(render('/download', plainAnchor)), undefined);
    assert.equal(relOf(render(appStoreUrl({ surface: 'team_cta', teamId: 'minnesota-twins' }), plainAnchor)), 'noopener');
  });
}
