import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal-layout';

export const metadata: Metadata = {
  title: 'Terms of Service: Usage Rules and Disclaimers',
  description:
    'The rules for using PromoNight: as-is service, data accuracy disclaimers, subscription terms for PromoNight Pro, and the usual liability boilerplate.',
  alternates: { canonical: 'https://www.getpromonight.com/terms' },
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="April 26, 2026">
      <p>PromoNight is operated by Kovalik Digital LLC (&quot;we&quot;, &quot;our&quot;). By using the PromoNight website at <a href="https://www.getpromonight.com">getpromonight.com</a> (&quot;the site&quot;) or the PromoNight mobile application (&quot;the app&quot;), you agree to the following terms. If you do not agree, please do not use the site or the app.</p>

      <h2>1. Service Description</h2>
      <p>PromoNight is a website and mobile application that aggregates and displays promotional event information (giveaways, theme nights, food deals, and other fan experiences) for professional sports teams. The site and app are provided <strong>as-is</strong> and <strong>as-available</strong>, without warranties of any kind, express or implied.</p>

      <h2>2. Promo Data Accuracy</h2>
      <p>We make every effort to provide accurate and up-to-date promotional information. However, <strong>teams may change, cancel, or modify promotions at any time without notice</strong>. PromoNight is not responsible for inaccurate, outdated, or missing promo information. Always verify promotions directly with the team or venue before attending a game based on a specific promotion.</p>

      <h2>3. Affiliate Links &amp; Commissions</h2>
      <p>PromoNight contains affiliate links to third-party services including ticket marketplaces (Ticketmaster), merchandise retailers (Fanatics), parking marketplaces (SpotHero), hotel marketplaces (Booking.com), sportsbooks, and other partners. <strong>We may earn a commission</strong> when you make a purchase or take a qualifying action through these links, at no additional cost to you. Affiliate relationships are managed through networks including Awin, Partnerize, Impact, CJ Affiliate, and FlexOffers.</p>
      <p>Affiliate relationships do not influence which promotions we display or how they are ranked. We are not responsible for the products, services, pricing, or policies of any third-party site. When you click an affiliate link, you leave PromoNight and are subject to the terms and privacy policies of the third-party platform.</p>

      <h2>3a. Advertising</h2>
      <p>The website may display advertisements served by Google AdSense and other advertising partners. We do not control the specific ads shown and do not endorse advertised products or services. Ads are served by third parties using cookies and similar technologies; see our <a href="/privacy">Privacy Policy</a> for opt-out information. Clicking an ad takes you to a third-party site governed by its own terms.</p>

      <h2>4. Subscriptions &amp; Payments</h2>
      <p>PromoNight Pro is an optional paid subscription that unlocks additional features including push notifications and Game Day venue access. Subscriptions are managed entirely through the Apple App Store or Google Play Store.</p>
      <ul>
        <li>Payment is charged to your App Store or Google Play account at confirmation of purchase.</li>
        <li>Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period.</li>
        <li>Refunds are handled according to Apple&apos;s or Google&apos;s refund policies. PromoNight does not process refunds directly.</li>
        <li>You can manage or cancel your subscription in your device&apos;s App Store or Google Play settings.</li>
      </ul>

      <h2>5. Game Day Feature</h2>
      <p>The Game Day feature provides venue amenity information such as food, drink, and service locations within sports stadiums. Access to Game Day content may require a PromoNight Pro subscription or a one-time venue unlock.</p>
      <ul>
        <li><strong>Venue data</strong> &mdash; amenity information is provided for informational purposes only. Venue layouts, offerings, locations, and availability may change without notice. PromoNight is not responsible for inaccuracies in venue amenity data.</li>
        <li><strong>Unlock state</strong> &mdash; your Game Day venue unlock is linked to an anonymous account and persists across sessions. Uninstalling the app or requesting data deletion may reset your unlock state.</li>
        <li><strong>Data availability</strong> &mdash; not all venues have amenity data available. If a venue has no data, no unlock or purchase will be prompted.</li>
      </ul>

      <h2>6. Location Services</h2>
      <p>PromoNight may request access to your device&apos;s location to enhance the Game Day experience, such as identifying nearby venues. Location access is entirely optional, and you may deny or revoke permission at any time through your device settings. The app remains fully functional without location access. Location data is processed on your device and is not stored on our servers or shared with third parties.</p>

      <h2>7. Live Activities &amp; Widgets</h2>
      <p>On supported devices, PromoNight may display game and promotion information through iOS Live Activities (lock screen and Dynamic Island) and home screen widgets. These features display promotional data already available within the app and do not collect additional personal information. You can remove Live Activities and widgets at any time through your device settings. The information displayed through these features is subject to the same accuracy limitations described in Section 2.</p>

      <h2>8. User Conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the site or app for any unlawful purpose.</li>
        <li>Attempt to reverse-engineer, decompile, or extract the source code of the app.</li>
        <li>Scrape, crawl, or systematically access site or app data or the underlying APIs.</li>
        <li>Interfere with or disrupt the site&apos;s or app&apos;s infrastructure or other users&apos; experience.</li>
        <li>Misrepresent your identity or impersonate any person or entity.</li>
        <li>Attempt to defeat, mask, or manipulate ad serving, ad measurement, or affiliate attribution.</li>
      </ul>

      <h2>9. Intellectual Property</h2>
      <p>All content, design, and code in PromoNight are owned by Kovalik Digital LLC or its licensors. Team names, logos, and promotional materials are the property of their respective owners and are displayed for informational purposes only.</p>

      <h2>10. Limitation of Liability</h2>
      <p>To the maximum extent permitted by law, Kovalik Digital LLC and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the site or the app, including but not limited to reliance on promo information, venue amenity data, third-party purchases, advertisements, or service interruptions.</p>

      <h2>11. Termination</h2>
      <p>We reserve the right to suspend or terminate access to the site or app at any time, for any reason, without notice. You may stop using the site by leaving it, or stop using the app by uninstalling it.</p>

      <h2>12. Changes to These Terms</h2>
      <p>We may update these terms from time to time. Continued use of the site or app after changes are posted constitutes acceptance of the updated terms. The &quot;Last updated&quot; date at the top of this page reflects the most recent revision.</p>

      <h2>13. Governing Law</h2>
      <p>These terms are governed by and construed in accordance with the laws of the State of Minnesota, United States, without regard to conflict of law principles. Any disputes arising under these terms shall be resolved in the state or federal courts located in Minnesota. Kovalik Digital LLC is a limited liability company registered in Minnesota.</p>

      <hr />
      <p className="text-text-secondary text-sm">
        Questions? Contact us at <a href="mailto:hello@getpromonight.com">hello@getpromonight.com</a>
      </p>
    </LegalLayout>
  );
}
