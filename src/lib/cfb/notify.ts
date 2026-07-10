import 'server-only';
import { db } from '@/lib/firebase';
import { sendEmail, esc, type SendResult } from '@/lib/email';
import { isValidEmail } from '@/lib/subscribers';

// Owner-facing ops notification for a new CFB contributor submission. This is
// internal transactional mail (owner -> owner), not commercial email, so it
// carries no CAN-SPAM postal footer or unsubscribe link, unlike the subscriber
// digests in lib/email.ts.
//
// STRICTLY BEST-EFFORT. The submission is already durably committed to
// cfbContributions before this is ever called. Nothing in here may throw into
// the route: sendEmail() never throws by contract, and the one Firestore read
// (the school display name) is individually guarded with a fallback.

const OWNER_EMAIL = 'kovalikdigital@gmail.com';

// This send sits on the contributor's submit request, so it is bounded. The
// submission is already stored; a slow Resend must not hold their spinner open.
const SEND_TIMEOUT_MS = 8_000;

export interface ContributionContent {
  whyYouGo: string;
  traditions: string;
  gameday: string;
  venueInWords: string;
  signatureGame: string;
}

export interface ContributionNotice {
  docId: string;
  schoolId: string;
  name: string;
  contact: string;
  content: ContributionContent;
  submittedAt: string;
  userAgent: string;
}

// The five prose answers in the order the contributor sees them on the form.
// Keys are exactly the `content` map keys written to cfbContributions.
const ANSWERS: ReadonlyArray<{ key: keyof ContributionContent; label: string }> = [
  { key: 'whyYouGo', label: 'Why you go' },
  { key: 'traditions', label: 'Traditions & theme nights' },
  { key: 'gameday', label: 'Gameday logistics (tailgating, parking, transit, gates)' },
  { key: 'venueInWords', label: 'The venue, in their words' },
  { key: 'signatureGame', label: 'The one game to plan around' },
];

const NOT_ANSWERED = '(not answered)';

/** Header-injection guard: subjects and Reply-To must be single-line. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

/** Display name for the school, falling back to the id if the lookup fails. */
async function schoolDisplayName(schoolId: string): Promise<string> {
  try {
    const snap = await db.collection('cfbSchools').doc(schoolId).get();
    const name = snap.exists ? (snap.data()?.name as string | undefined) : undefined;
    return name || schoolId;
  } catch {
    return schoolId;
  }
}

function bodyHtml(n: ContributionNotice, schoolName: string): string {
  const answers = ANSWERS.map(({ key, label }) => {
    const v = n.content[key];
    const value = v
      ? `<div style="white-space:pre-wrap;margin-top:4px;">${esc(v)}</div>`
      : `<div style="margin-top:4px;color:#999;">${NOT_ANSWERED}</div>`;
    return `<div style="margin:0 0 18px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#666;">${esc(label)}</div>
      ${value}
    </div>`;
  }).join('\n');

  const contact = isValidEmail(n.contact)
    ? `<a href="mailto:${esc(n.contact)}">${esc(n.contact)}</a>`
    : esc(n.contact);

  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#111;">
  <h1 style="font-size:18px;margin:0 0 4px;">New ${esc(schoolName)} game-day submission</h1>
  <p style="margin:0 0 20px;color:#666;">Sitting in <code>cfbContributions</code> as pending-review. Nothing is published.</p>

  <table style="border-collapse:collapse;margin:0 0 24px;font-size:14px;">
    <tr><td style="padding:2px 16px 2px 0;color:#666;">School</td><td>${esc(schoolName)} <span style="color:#999;">(${esc(n.schoolId)})</span></td></tr>
    <tr><td style="padding:2px 16px 2px 0;color:#666;">Contributor</td><td>${esc(n.name)}</td></tr>
    <tr><td style="padding:2px 16px 2px 0;color:#666;">Contact</td><td>${contact}</td></tr>
    <tr><td style="padding:2px 16px 2px 0;color:#666;">Submitted</td><td>${esc(n.submittedAt)}</td></tr>
    <tr><td style="padding:2px 16px 2px 0;color:#666;">Doc ID</td><td><code>${esc(n.docId)}</code></td></tr>
  </table>

  <hr style="border:0;border-top:1px solid #e5e5e5;margin:0 0 24px;">
  ${answers}
  <hr style="border:0;border-top:1px solid #e5e5e5;margin:24px 0 12px;">
  <p style="font-size:12px;color:#999;margin:0;">User agent: ${esc(n.userAgent || '(none)')}</p>
</body>
</html>`;
}

function bodyText(n: ContributionNotice, schoolName: string): string {
  const answers = ANSWERS.map(({ key, label }) => `${label.toUpperCase()}\n${n.content[key] || NOT_ANSWERED}`).join('\n\n');
  return `New ${schoolName} game-day submission

Sitting in cfbContributions as pending-review. Nothing is published.

School:      ${schoolName} (${n.schoolId})
Contributor: ${n.name}
Contact:     ${n.contact}
Submitted:   ${n.submittedAt}
Doc ID:      ${n.docId}

----------------------------------------

${answers}

----------------------------------------
User agent: ${n.userAgent || '(none)'}
`;
}

/**
 * Emails the full submission to the owner. Resolves a SendResult; never throws
 * (sendEmail swallows its own failures, and the name lookup falls back).
 */
export async function sendContributionNotification(n: ContributionNotice): Promise<SendResult> {
  const schoolName = await schoolDisplayName(n.schoolId);
  // Reply-To only when the contact is a real address, so replying credits the
  // contributor. A LinkedIn URL or bare handle there would make Resend reject
  // the whole send, which would cost us the notification.
  const replyTo = isValidEmail(n.contact) ? oneLine(n.contact) : undefined;

  return sendEmail({
    to: OWNER_EMAIL,
    subject: oneLine(`New ${schoolName} game-day submission from ${n.name}`),
    html: bodyHtml(n, schoolName),
    text: bodyText(n, schoolName),
    replyTo,
    timeoutMs: SEND_TIMEOUT_MS,
  });
}
