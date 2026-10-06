// The nightly refresh's own user agent (WEB6 G4). A module of its own so the
// middleware can recognise the job's requests without importing the job.
//
// It contains "bot", so the traffic classifier never calls it human; and the
// middleware skips the server-side request counter for it entirely, because
// the job requests about 400 pages twice a night and every counted request is
// a write to that hour's single counter document.
export const REFRESH_USER_AGENT = 'PromoNightRefreshBot/1.0';

export function isNightlyRefreshRequest(userAgent: string | null): boolean {
  return userAgent === REFRESH_USER_AGENT;
}
