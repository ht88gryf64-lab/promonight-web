import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal-layout';

export const metadata: Metadata = {
  title: 'Privacy Policy: What We Collect and How It\'s Used',
  description:
    'PromoNight privacy policy: what we collect on web and mobile, third-party services (analytics, affiliate networks, ads), and how to opt out.',
  alternates: { canonical: 'https://www.getpromonight.com/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="April 26, 2026">
      <p>
        PromoNight is operated by Kovalik Digital LLC (&quot;we&quot;, &quot;our&quot;). This policy covers both the PromoNight website at <a href="https://www.getpromonight.com">getpromonight.com</a> and the PromoNight mobile application. It explains what data we collect, how we use it, who we share it with, and your rights.
      </p>

      <h2>1. Information We Collect on the Website</h2>
      <p>When you visit getpromonight.com, our servers and analytics partners may collect:</p>
      <ul>
        <li><strong>Request metadata</strong> &mdash; IP address, user-agent (browser and operating system), referrer URL, and the pages you view. This is logged in standard server logs and used by our analytics tools.</li>
        <li><strong>Analytics events</strong> &mdash; pages viewed, links clicked, scroll depth, time on page, search queries entered on the site, and similar interaction events.</li>
        <li><strong>Cookies and similar storage</strong> &mdash; we use first-party cookies and browser local storage to keep an attribution context (e.g., the campaign or referral that brought you to the site) and to power analytics. See Section 6 for details.</li>
        <li><strong>Approximate location</strong> &mdash; we may infer city/region from your IP address to order content (for example, surfacing promos for teams near you). We do not request precise device GPS on the website.</li>
      </ul>

      <h2>2. Information We Collect in the Mobile App</h2>
      <ul>
        <li><strong>Anonymous user identifier</strong> &mdash; when you first open the app, we create an anonymous account using Firebase Authentication. This generates a unique identifier (UID) that is not tied to your name, email, or any personal contact information.</li>
        <li><strong>Starred teams</strong> &mdash; the teams you follow, stored locally on your device and synced to our servers to personalize your experience.</li>
        <li><strong>Notification preferences</strong> &mdash; whether you&apos;ve enabled game-day alerts and your alert settings.</li>
        <li><strong>Firebase Cloud Messaging (FCM) token</strong> &mdash; a device identifier used solely to deliver push notifications you&apos;ve opted into.</li>
        <li><strong>Analytics events</strong> &mdash; anonymous usage data such as which screens you view, buttons you tap, and features you use. Firebase Analytics may also automatically collect device information such as device model, operating system version, app version, and session duration.</li>
        <li><strong>Purchase information</strong> &mdash; subscription status for PromoNight Pro, managed entirely through Apple App Store or Google Play. We do not collect or store your payment information, credit card number, or billing details.</li>
        <li><strong>Location data (optional)</strong> &mdash; if you grant permission, the app may access your device&apos;s location to determine your proximity to sports venues for the Game Day feature. Location data is processed on-device. You can revoke location permission at any time through your device settings.</li>
        <li><strong>Game Day venue unlock state</strong> &mdash; if you use the Game Day feature, we store which venue you have unlocked, linked to your anonymous user identifier.</li>
      </ul>

      <h2>3. How We Use Information</h2>
      <ul>
        <li><strong>Operating the service</strong> &mdash; serving promo, schedule, and venue content, and keeping the site and app online and secure.</li>
        <li><strong>Personalization</strong> &mdash; ordering content by the teams and regions you appear to be interested in.</li>
        <li><strong>Affiliate attribution</strong> &mdash; when you click an outbound link to a ticket marketplace, parking marketplace, hotel marketplace, sportsbook, merchandise retailer, or other affiliate partner, we record the click so the partner can pay us a commission if you complete a purchase. We do not see your payment details.</li>
        <li><strong>Product improvement</strong> &mdash; understanding which pages, features, and content perform well so we can improve them.</li>
        <li><strong>Notifications and customer support</strong> &mdash; sending alerts you&apos;ve opted into and responding to inquiries.</li>
      </ul>

      <h2>4. Third-Party Services</h2>
      <p>We share data with the following providers strictly to operate the service. We do not sell, rent, or trade your personal data.</p>
      <ul>
        <li><strong>Firebase (Google)</strong> &mdash; anonymous authentication, Firestore data storage, push notifications (FCM), and analytics for the mobile app. Google&apos;s privacy policy applies: <a href="https://policies.google.com/privacy">policies.google.com/privacy</a>.</li>
        <li><strong>PostHog</strong> &mdash; product analytics on the website (events, session metadata). PostHog&apos;s privacy policy: <a href="https://posthog.com/privacy">posthog.com/privacy</a>.</li>
        <li><strong>Google Analytics 4</strong> &mdash; aggregate website traffic analytics. Google&apos;s privacy policy applies; you can install the Google Analytics opt-out browser add-on at <a href="https://tools.google.com/dlpage/gaoptout">tools.google.com/dlpage/gaoptout</a>.</li>
        <li><strong>Vercel</strong> &mdash; website hosting and CDN. Standard server logs (IP, user-agent, request paths) are processed by Vercel as part of serving the site.</li>
        <li><strong>Affiliate networks</strong> &mdash; we participate in affiliate programs operated by Awin, Partnerize, Impact, CJ Affiliate, FlexOffers, and similar networks. When you click an outbound affiliate link, the destination partner and the network drop their own cookies on the destination site to attribute any subsequent purchase. We are not in control of those cookies.</li>
        <li><strong>Ad networks</strong> &mdash; see Section 5.</li>
        <li><strong>Ticketmaster, Fanatics, SpotHero, Booking.com, and other linked partners</strong> &mdash; ticket, merchandise, parking, and hotel marketplaces we link out to. Their privacy policies govern any data collected on their sites.</li>
      </ul>
      <p>
        When you tap or click links to third-party sites, you leave PromoNight and become subject to the terms and privacy policies of those platforms. We are not responsible for their practices and encourage you to review their policies.
      </p>

      <h2>5. Advertising</h2>
      <p>
        Pages on getpromonight.com may display advertisements served by Google AdSense and, in the future, other advertising partners. Ad networks and their downstream partners use cookies, web beacons, and similar technologies to:
      </p>
      <ul>
        <li>Serve ads based on your prior visits to this and other websites.</li>
        <li>Measure ad delivery, engagement, and conversion.</li>
        <li>Detect fraud and invalid traffic.</li>
      </ul>
      <p>
        Google&apos;s use of advertising cookies enables it and its partners to serve ads based on your visit to our site and other sites on the internet. You can review and adjust personalized advertising preferences at <a href="https://www.google.com/settings/ads">google.com/settings/ads</a>.
      </p>
      <p>
        For broader opt-out controls covering many advertising networks at once, visit the Digital Advertising Alliance&apos;s consumer choice page at <a href="https://optout.aboutads.info">optout.aboutads.info</a>, or the Network Advertising Initiative at <a href="https://optout.networkadvertising.org">optout.networkadvertising.org</a>. Users in the EU, UK, or Switzerland can use the European Interactive Digital Advertising Alliance opt-out at <a href="https://www.youronlinechoices.eu">youronlinechoices.eu</a>.
      </p>
      <p>
        A current list of ad networks we work with is published at <a href="https://www.getpromonight.com/ads.txt">getpromonight.com/ads.txt</a>. If we add new networks, we will update that file and this section.
      </p>

      <h2>6. Cookies and Local Storage</h2>
      <p>We use the following categories of cookies and browser storage on the website:</p>
      <ul>
        <li><strong>Strictly necessary</strong> &mdash; required for the site to function (for example, remembering that you&apos;ve dismissed a banner).</li>
        <li><strong>Analytics</strong> &mdash; PostHog and Google Analytics 4 cookies/identifiers used to measure traffic and product usage.</li>
        <li><strong>Attribution</strong> &mdash; a first-party cookie that records the source/medium/campaign that brought you to the site, so affiliate referrals can be attributed correctly.</li>
        <li><strong>Advertising</strong> &mdash; set by Google AdSense and other ad partners when ads are displayed, used for ad serving, frequency capping, and measurement.</li>
      </ul>
      <p>
        Most browsers let you control cookies through their settings &mdash; you can block all cookies, block third-party cookies only, or clear existing cookies. Disabling cookies will not break browsing the site, but may reduce relevance of content and ads.
      </p>

      <h2>7. Local Data Storage in the App</h2>
      <p>
        The mobile app caches certain data on your device to enable offline access and improve performance, including promotional event data, venue amenity information, and your preferences. This cached data is stored locally and is not transmitted to any third party. Cached data is refreshed periodically when you are connected to the internet and is removed when you uninstall the app.
      </p>

      <h2>8. Data Retention &amp; Deletion</h2>
      <p>
        Server logs and analytics events are retained on a rolling basis (typically up to 24 months) and then aggregated or deleted. Your starred teams, notification preferences, and Game Day venue unlock state are stored on your device and in our database, linked to your anonymous user identifier.
      </p>
      <p>
        To request deletion of server-side data &mdash; including your anonymous user identifier, FCM token, preferences, Game Day unlock state, and any analytics records we can tie to you &mdash; contact us at <a href="mailto:privacy@getpromonight.com">privacy@getpromonight.com</a>. We will process your request within 30 days.
      </p>

      <h2>9. Your Rights</h2>
      <p><strong>GDPR (European Union, UK, Switzerland):</strong> You have the right to access, correct, delete, or export your personal data, and to object to or restrict processing. Contact us to exercise these rights.</p>
      <p><strong>CCPA / CPRA (California):</strong> You have the right to know what personal information we collect, request deletion, and opt out of the sale or sharing of personal information for cross-context behavioral advertising. We do not sell personal information for money. To opt out of advertising-based sharing, follow the instructions in Section 5 and email us at <a href="mailto:privacy@getpromonight.com">privacy@getpromonight.com</a> if you would like us to suppress advertising cookies for your visits.</p>

      <h2>10. Children&apos;s Privacy</h2>
      <p>The PromoNight website and app are not directed to children under 13, and we do not knowingly collect personal data from children under 13. If you believe a child has provided us with personal data, please contact us and we will delete it.</p>

      <h2>11. Changes to This Policy</h2>
      <p>We may update this policy from time to time. The &quot;Last updated&quot; date at the top of this page reflects the most recent revision. Material changes will be highlighted on the site or in the app.</p>

      <hr />
      <p className="text-text-secondary text-sm">
        Questions or requests? Contact us at <a href="mailto:privacy@getpromonight.com">privacy@getpromonight.com</a>. Postal address: Kovalik Digital LLC, Minnesota, USA.
      </p>
    </LegalLayout>
  );
}
