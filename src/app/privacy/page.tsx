import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal-layout';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'PromoNight privacy policy — what data we collect, how we use it, and your rights.',
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="April 1, 2026">
      <p>
        PromoNight (&quot;we&quot;, &quot;our&quot;, &quot;the app&quot;) is a mobile application that helps fans discover promotional events at professional sports games. This policy explains what data we collect, how we use it, and your rights.
      </p>

      <h2>1. Data We Collect</h2>
      <p>We collect the following information when you use PromoNight:</p>
      <ul>
        <li><strong>Anonymous user identifier</strong> &mdash; when you first open PromoNight, we create an anonymous account using Firebase Authentication. This generates a unique identifier (UID) that is not tied to your name, email, or any personal contact information. This UID is used to persist your preferences, subscription status, and Game Day venue unlock state across sessions.</li>
        <li><strong>Starred teams</strong> &mdash; the teams you follow, stored locally on your device and synced to our servers to personalize your experience.</li>
        <li><strong>Notification preferences</strong> &mdash; whether you&apos;ve enabled game-day alerts and your alert settings.</li>
        <li><strong>Firebase Cloud Messaging (FCM) token</strong> &mdash; a device identifier used solely to deliver push notifications you&apos;ve opted into.</li>
        <li><strong>Analytics events</strong> &mdash; anonymous usage data such as which screens you view, buttons you tap, and features you use. Firebase Analytics may also automatically collect device information such as device model, operating system version, app version, and session duration. This data is not tied to your personal identity.</li>
        <li><strong>Purchase information</strong> &mdash; subscription status for PromoNight Pro, managed entirely through Apple App Store or Google Play. We do not collect or store your payment information, credit card number, or billing details.</li>
        <li><strong>Location data (optional)</strong> &mdash; if you grant permission, PromoNight may access your device&apos;s location to determine your proximity to sports venues for the Game Day feature. Location data is used on-device to identify nearby venues and is not stored on our servers or shared with third parties. You can revoke location permission at any time through your device settings, and the app remains fully functional without it.</li>
        <li><strong>Game Day venue unlock state</strong> &mdash; if you use the Game Day feature, we store which venue you have unlocked, linked to your anonymous user identifier. This data is stored in Firebase Firestore.</li>
      </ul>

      <h2>2. How We Use Your Data</h2>
      <ul>
        <li><strong>Personalization</strong> &mdash; showing promos for your starred teams and tailoring the home feed.</li>
        <li><strong>Notifications</strong> &mdash; sending game-day alerts for upcoming promotional events.</li>
        <li><strong>Game Day</strong> &mdash; displaying venue amenity information and determining your proximity to stadiums when location permission is granted.</li>
        <li><strong>Live Activities (iOS)</strong> &mdash; if you are using an iOS device, PromoNight may display game and promotion information on your lock screen and Dynamic Island via iOS Live Activities. This feature uses promo data already available in the app and does not collect additional personal information.</li>
        <li><strong>Product improvement</strong> &mdash; understanding which features are used to make PromoNight better.</li>
        <li><strong>Customer support</strong> &mdash; responding to inquiries you send us.</li>
      </ul>

      <h2>3. Local Data Storage</h2>
      <p>
        PromoNight caches certain data on your device to enable offline access and improve performance. This includes promotional event data, venue amenity information, and your preferences. This cached data is stored locally using on-device storage and is not transmitted to any third party. Cached data is refreshed periodically when you are connected to the internet and is removed when you uninstall the app.
      </p>

      <h2>4. Third-Party Services</h2>
      <p>PromoNight integrates with the following third-party services:</p>
      <ul>
        <li><strong>Firebase (Google)</strong> &mdash; for anonymous authentication, data storage (Firestore), push notifications (FCM), and analytics. Google&apos;s privacy policy applies: <a href="https://policies.google.com/privacy">policies.google.com/privacy</a>.</li>
        <li><strong>Fanatics</strong> &mdash; merchandise links. When you tap &quot;Fan Gear,&quot; you are directed to Fanatics. Their privacy policy governs any data collected on their site.</li>
        <li><strong>SeatGeek &amp; StubHub</strong> &mdash; ticket marketplace links provided through the Impact affiliate network. Their respective privacy policies govern data collected when you visit their sites.</li>
      </ul>
      <p>
        When you tap ticket or merchandise links within PromoNight, you will leave the app and be directed to these third-party platforms. We are not responsible for the privacy practices of these external sites and encourage you to review their privacy policies. PromoNight may earn a commission on purchases made through these affiliate links.
      </p>
      <p>We share your data with these services only as necessary to provide app functionality. We do not sell, rent, or trade your personal data to any third party.</p>

      <h2>5. Data Retention &amp; Deletion</h2>
      <p>
        Your starred teams, notification preferences, and Game Day venue unlock state are stored on your device and in our database, linked to your anonymous user identifier. Analytics data is retained in aggregate form.
      </p>
      <p>
        To delete your data, uninstall the app and your local data &mdash; including all cached promo and venue information &mdash; is removed immediately. To request deletion of server-side data (anonymous user identifier, FCM token, preferences, and Game Day unlock state), contact us at <a href="mailto:privacy@getpromonight.com">privacy@getpromonight.com</a> and we will process your request within 30 days.
      </p>

      <h2>6. Your Rights</h2>
      <p><strong>GDPR (European Union):</strong> You have the right to access, correct, delete, or export your personal data. You may also object to or restrict processing. Contact us to exercise these rights.</p>
      <p><strong>CCPA (California):</strong> You have the right to know what personal information we collect, request deletion, and opt out of the sale of personal information. We do not sell personal information.</p>

      <h2>7. Children&apos;s Privacy</h2>
      <p>PromoNight is not directed at children under 13. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us and we will delete it.</p>

      <h2>8. Changes to This Policy</h2>
      <p>We may update this policy from time to time. We will notify you of material changes by posting the updated policy in the app or on our website. The &quot;Last updated&quot; date at the top of this page reflects the most recent revision.</p>

      <hr />
      <p className="text-text-secondary text-sm">
        Questions or requests? Contact us at <a href="mailto:privacy@getpromonight.com">privacy@getpromonight.com</a>
      </p>
    </LegalLayout>
  );
}
