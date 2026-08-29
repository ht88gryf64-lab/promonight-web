import Image from 'next/image';

// The asset is committed at public/matt-avatar.jpg, so its existence is a
// BUILD-TIME fact and there is nothing for the runtime to discover.
//
// This used to gate the <Image> on existsSync(join(process.cwd(), 'public',
// 'matt-avatar.jpg')). That check could only ever produce a FALSE NEGATIVE: on
// Vercel, `public/` is served as a static asset and is not guaranteed to be in
// the traced filesystem of an ISR lambda, so a re-render could decide the photo
// was missing and silently swap in the letter-M placeholder. Correct on the
// build-time prerender, wrong on a lambda render, with no error and no log —
// the failure mode was a page that quietly stopped showing the founder.
//
// Deleting the check removes the failure class rather than papering over it. If
// the asset is ever removed, the build breaks loudly at the import site, which
// is the outcome we want.
export function AvatarMatt({ size = 48 }: { size?: number }) {
  return (
    <Image
      src="/matt-avatar.jpg"
      alt="Matt, founder of PromoNight"
      width={size}
      height={size}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
