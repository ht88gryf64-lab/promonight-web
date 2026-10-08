import type { Metadata } from 'next';
import { pageOpenGraph } from '@/lib/og';
import { LegalLayout } from '@/components/legal-layout';

// The app section follows the app repo's docs/launch/privacy-draft.html (2.0
// launch): free with ads, no purchases, starred teams and reminders on the
// device only. "No session replay" is an APP fact; the website records a
// sample of sessions in PostHog (AnalyticsProvider), so that line stays scoped
// to the app. Checked 2026-10-07: PostHog project 393054 has
// session_recording_opt_in true, sample rate 0.25, retention 30d, console logs
// on; the email signup stores email, teams, source and timestamps, and no
// IP-derived location since main 59f2375 (api/subscribe). Re-check both lines
// when either setting changes. App search terms (2026-10-08): the app's
// search_query event carries `query` from Discover and from Add Teams, to both
// sinks (app lib/services/analytics). Consent: UMP via admob_provider.dart; the
// More tab row shows only when Google reports privacy options are required.
export const metadata: Metadata = {
  title: 'Privacy Policy: What We Collect and How It\'s Used',
  description:
    'PromoNight privacy policy: what we collect on web and mobile, third-party services (analytics, crash reporting, affiliate networks, ads), and how to opt out.',
  alternates: { canonical: 'https://www.getpromonight.com/privacy' },
  openGraph: pageOpenGraph('/privacy'),
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="October 8, 2026">
      <p>
        PromoNight is operated by Kovalik Digital LLC (&quot;we&quot;, &quot;our&quot;). This policy covers both the PromoNight website at <a href="https://www.getpromonight.com">getpromonight.com</a> and the PromoNight mobile application. It explains what data we collect, how we use it, who we share it with, and your rights.
      </p>

      <h2>1. Information We Collect on the Website</h2>
      <p>When you visit getpromonight.com, our servers and analytics partners may collect:</p>
      <ul>
        <li><strong>Request metadata.</strong> IP address, user-agent (browser and operating system), referrer URL, and the pages you view. This is logged in standard server logs and used by our analytics tools.</li>
        <li><strong>Analytics events.</strong> Pages viewed, links clicked, scroll depth, time on page, search queries entered on the site, and similar interaction events.</li>
        <li><strong>Session recordings.</strong> PostHog records about one in four website visits (page layout, scrolling, clicks, and browser console messages) so we can see where the site is hard to use. Text you type into form fields is masked, recording is turned off on the email confirmation and email preferences pages, and recordings are deleted after 30 days.</li>
        <li><strong>Email updates.</strong> If you sign up for PromoNight emails, we store your email address, the teams you picked, the page you signed up from, and when you signed up and confirmed. We use them to send the emails you asked for. Every email has an unsubscribe link.</li>
        <li><strong>Cookies and similar storage.</strong> We use first-party cookies and browser local storage to keep an attribution context (for example, the campaign or referral that brought you to the site) and to power analytics. See Section 6 for details.</li>
        <li><strong>Approximate location.</strong> The /follow page reads an approximate location from your request (derived from your IP address) to list nearby teams first, and the homepage team list and My Teams use your state or region from the request the same way. It is not stored on our servers: only the state or region code is kept in your browser, for up to 24 hours, so the order stays steady. We do not request precise device GPS on the website.</li>
      </ul>

      <h2>2. Information We Collect in the Mobile App</h2>
      <ul>
        <li><strong>Anonymous account.</strong> The first time you open the app we create an anonymous account for it: a random ID with no name, email address or password. The app needs it to read promo data.</li>
        <li><strong>Account record.</strong> A record in our database under that ID. It holds the date the account was created, the date it was last updated, and the push token described below.</li>
        <li><strong>Starred teams.</strong> The teams you follow. This list is stored only on your device.</li>
        <li><strong>Reminder choices.</strong> Whether promo day reminders are on, whether they are limited to highlighted promos, which of your teams are muted, and the promos you added with &quot;Remind me&quot;. These are stored only on your device, and the reminders themselves are scheduled on your device.</li>
        <li><strong>Location.</strong> If you allow it, the Game Day tab uses your location on your device to find stadiums near you. Your location is not sent to or stored on our servers.</li>
        <li><strong>Firebase Cloud Messaging (FCM) token.</strong> A device identifier that push notifications can be sent to. The app stores it in your account record whenever it can obtain one, whether or not you allow notifications. We do not currently send push notifications; promo day reminders are scheduled on your device.</li>
        <li><strong>Venue feedback.</strong> If you send feedback from the Game Day tab, we store the text you write, the stadium it is about, and your anonymous account ID.</li>
        <li><strong>Analytics events.</strong> Anonymous usage data such as which screens you view, buttons you tap, and features you use. This includes starring a team, changing an alert setting, and which stadium the Game Day tab shows. Events are tied to the anonymous account ID, never to your name, email address or location. We send them to PostHog and to Firebase Analytics. The app does not record your screen or sessions, and it does not use the advertising identifier for analytics.</li>
        <li><strong>Search terms.</strong> The words you type into the app&apos;s searches (the Discover search, and the team search when you add teams) are sent with these analytics events so we can improve search. Like other events, they are linked to the anonymous account ID. They are never used for ads.</li>
        <li><strong>Crash reports.</strong> If the app crashes, Firebase Crashlytics receives a report with the stack trace, the app version, your device model and operating system version, and a device identifier Crashlytics generates. It carries no name, email address or location.</li>
        <li><strong>Advertising.</strong> The app shows a small number of ads from Google AdMob, marked &quot;Sponsored&quot;. To request and measure ads, Google&apos;s ads software collects your device&apos;s advertising identifier (where your device makes one available), your IP address, device and app information, and which ads were shown and tapped. The app does not ask for permission to track you across other companies&apos; apps and websites, and it requests non-personalized ads. If you are in the European Economic Area, the UK or Switzerland, the app shows Google&apos;s consent form before any ad is requested. If you are in a US state with its own privacy law, the app shows Google&apos;s US state privacy message. Either way, you can change your choice later from &quot;Ad privacy options&quot; in the app&apos;s More tab.</li>
      </ul>
      <p>The app has no purchases or subscriptions. We do not collect your name, email address, or phone number in the app unless you choose to give it to us (for example, by contacting support).</p>

      <h2>3. How We Use Information</h2>
      <ul>
        <li><strong>Operating the service.</strong> Serving promo, schedule, and venue content, and keeping the site and app online and secure.</li>
        <li><strong>Personalization.</strong> Showing promos for the teams you follow and ordering content by the teams and regions you appear to be interested in.</li>
        <li><strong>Reminders.</strong> Reminding you in the app on the morning of promo games for your starred teams. These reminders are scheduled on your device.</li>
        <li><strong>Affiliate attribution.</strong> When you click an outbound link to a ticket marketplace, parking marketplace, hotel marketplace, merchandise retailer, or resale marketplace, we record the click so the partner can pay us a commission if you complete a purchase. We do not see your payment details.</li>
        <li><strong>Product improvement.</strong> Understanding which pages, features, and content perform well so we can improve them.</li>
        <li><strong>Stability.</strong> Finding and fixing app crashes.</li>
        <li><strong>Advertising.</strong> Showing and measuring the ads that keep the site and the app free.</li>
        <li><strong>Email and customer support.</strong> Sending the emails you signed up for and responding to inquiries and feedback you send us.</li>
      </ul>

      <h2>4. Third-Party Services</h2>
      <p>We share data with the following providers strictly to operate the service. We do not sell, rent, or trade your personal data.</p>
      <ul>
        <li><strong>Firebase (Google).</strong> Anonymous authentication, Firestore data storage, messaging infrastructure (FCM), analytics (Firebase Analytics) and crash reporting (Crashlytics) for the mobile app. Google&apos;s privacy policy applies: <a href="https://policies.google.com/privacy">policies.google.com/privacy</a>.</li>
        <li><strong>PostHog.</strong> Product analytics and session recordings on the website, and product analytics in the app, where it receives the same anonymous events as Firebase Analytics. PostHog&apos;s privacy policy: <a href="https://posthog.com/privacy">posthog.com/privacy</a>.</li>
        <li><strong>Google Analytics 4.</strong> Aggregate website traffic analytics. Google&apos;s privacy policy applies: <a href="https://policies.google.com/privacy">policies.google.com/privacy</a>. You can install the Google Analytics opt-out browser add-on at <a href="https://tools.google.com/dlpage/gaoptout">tools.google.com/dlpage/gaoptout</a>.</li>
        <li><strong>Google AdMob.</strong> Advertising in the app. How Google uses data from apps that show its ads: <a href="https://policies.google.com/technologies/partner-sites">policies.google.com/technologies/partner-sites</a>.</li>
        <li><strong>Vercel.</strong> Website hosting and CDN. Standard server logs (IP, user-agent, request paths) are processed by Vercel as part of serving the site.</li>
        <li><strong>Resend.</strong> Delivery of the emails you sign up for on the website.</li>
        <li><strong>Affiliate networks and programs.</strong> We participate in the Impact affiliate network (Ticketmaster, TicketNetwork, and Fanatics), the eBay Partner Network, and the in-house affiliate programs operated by SpotHero and Expedia. When you click an outbound affiliate link, the destination partner and its network drop their own cookies on the destination site to attribute any subsequent purchase. We are not in control of those cookies.</li>
        <li><strong>Ad networks.</strong> See Section 5.</li>
        <li><strong>Ticketmaster, TicketNetwork, Fanatics, SpotHero, Expedia, and eBay.</strong> The ticket, merchandise, parking, hotel, and resale marketplaces we link out to. Their privacy policies govern any data collected on their sites or in their apps.</li>
      </ul>
      <p>
        When you tap or click links to third-party sites, you leave PromoNight and become subject to the terms and privacy policies of those platforms. We are not responsible for their practices and encourage you to review their policies.
      </p>

      <h2>5. Advertising</h2>
      <p>
        <strong>On the website.</strong> CMI Marketing, Inc., d/b/a Raptive (&quot;Raptive&quot;) is a service provider of this Site for the purposes of placing advertising on the Site, and Raptive will collect and use certain data for advertising purposes. To learn more about Raptive&apos;s data usage, click here: <a href="https://raptive.com/creator-advertising-privacy-statement/">https://raptive.com/creator-advertising-privacy-statement/</a>
      </p>
      <p>
        Pages on getpromonight.com may display advertisements delivered through Raptive and through Google AdSense. Raptive works with a marketplace of ad networks and exchanges, so the specific advertiser and network serving a given ad will vary. Ad networks and their downstream partners use cookies, web beacons, and similar technologies to:
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
        A current list of ad networks we work with on the website is published at <a href="https://www.getpromonight.com/ads.txt">getpromonight.com/ads.txt</a>. If we add new networks, we will update that file and this section.
      </p>
      <p>
        <strong>In the app.</strong> The app shows a small number of ads from Google AdMob, marked &quot;Sponsored&quot;, and requests them as non-personalized. It does not ask for permission to track you across other companies&apos; apps and websites. Section 2 lists the data Google&apos;s ads software collects to show and measure them.
      </p>

      <h2>6. Cookies and Local Storage</h2>
      <p>We use the following categories of cookies and browser storage on the website:</p>
      <ul>
        <li><strong>Strictly necessary.</strong> Required for the site to function (for example, remembering that you&apos;ve dismissed a banner).</li>
        <li><strong>Analytics.</strong> PostHog and Google Analytics 4 cookies and identifiers used to measure traffic and product usage.</li>
        <li><strong>Attribution.</strong> A first-party cookie that records the source, medium and campaign that brought you to the site, so affiliate referrals can be attributed correctly.</li>
        <li><strong>Advertising.</strong> Set by Google AdSense and other ad partners when ads are displayed, used for ad serving, frequency capping, and measurement.</li>
      </ul>
      <p>
        Most browsers let you control cookies through their settings: you can block all cookies, block third-party cookies only, or clear existing cookies. Disabling cookies will not break browsing the site, but may reduce relevance of content and ads.
      </p>

      <h2>7. Local Data Storage in the App</h2>
      <p>
        Your starred teams and reminder choices are stored only on your device. The app also keeps a copy of promo, schedule and venue information on your device so it opens quickly and works offline. This data is not sent to any third party, is refreshed when you are connected to the internet, and is removed when you uninstall the app.
      </p>

      <h2>8. Data Retention &amp; Deletion</h2>
      <p>
        Server logs and analytics events are retained on a rolling basis (typically up to 24 months) and then aggregated or deleted. In the app, uninstalling removes the data stored on your device immediately.
      </p>
      <p>
        To request deletion of server-side data (the app&apos;s account record, push token, and any venue feedback you sent, the email address and teams from a website signup, and any analytics records we can tie to you), contact us at <a href="mailto:privacy@getpromonight.com">privacy@getpromonight.com</a>. We will process your request within 30 days.
      </p>

      <h2>9. Your Rights</h2>
      <p><strong>GDPR (European Union, UK, Switzerland):</strong> You have the right to access, correct, delete, or export your personal data, and to object to or restrict processing. Contact us to exercise these rights.</p>
      <p><strong>CCPA / CPRA (California):</strong> You have the right to know what personal information we collect, request deletion, and opt out of the sale or sharing of personal information for cross-context behavioral advertising. We do not sell personal information for money, and the ads in the app are requested as non-personalized. To opt out of advertising-based sharing on the website, follow the instructions in Section 5 and email us at <a href="mailto:privacy@getpromonight.com">privacy@getpromonight.com</a> if you would like us to suppress advertising cookies for your visits.</p>

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
