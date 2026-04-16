import Link from 'next/link';
import { getAllTeams } from '@/lib/data';
import { FooterTeamSitemap } from './footer-team-sitemap';

export async function Footer() {
  const teams = await getAllTeams();

  return (
    <footer className="relative z-[1] border-t border-border-subtle bg-bg">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="font-display text-xl tracking-wider mb-3">
              <span className="text-white">PROMO</span>
              <span className="text-accent-red">NIGHT</span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed max-w-sm">
              Track every giveaway, theme night, food deal, and promotion across 167 teams in MLB, NBA, NHL, NFL, MLS, and WNBA.
            </p>
          </div>

          {/* Browse */}
          <div>
            <h4 className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red mb-4">
              Browse
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/promos/this-week" className="text-text-secondary text-sm hover:text-white transition-colors">
                  Hot this week
                </Link>
              </li>
              <li>
                <Link href="/promos/bobbleheads" className="text-text-secondary text-sm hover:text-white transition-colors">
                  Bobbleheads
                </Link>
              </li>
              <li>
                <Link href="/promos/jersey-giveaways" className="text-text-secondary text-sm hover:text-white transition-colors">
                  Jersey giveaways
                </Link>
              </li>
              <li>
                <Link href="/promos/theme-nights" className="text-text-secondary text-sm hover:text-white transition-colors">
                  Theme nights
                </Link>
              </li>
              <li>
                <Link href="/teams" className="text-text-secondary text-sm hover:text-white transition-colors">
                  All teams
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red mb-4">
              Company
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-text-secondary text-sm hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/download" className="text-text-secondary text-sm hover:text-white transition-colors">
                  Download
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-text-secondary text-sm hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-text-secondary text-sm hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a href="mailto:hello@getpromonight.com" className="text-text-secondary text-sm hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <FooterTeamSitemap teams={teams} />

        <div className="mt-12 pt-8 border-t border-border-subtle">
          <p className="text-text-dim text-xs font-mono">
            &copy; {new Date().getFullYear()} PromoNight. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
