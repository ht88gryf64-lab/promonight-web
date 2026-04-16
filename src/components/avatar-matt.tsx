import Image from 'next/image';
import { existsSync } from 'fs';
import { join } from 'path';

export function AvatarMatt({ size = 48 }: { size?: number }) {
  const avatarPath = join(process.cwd(), 'public', 'matt-avatar.jpg');
  const hasAvatar = existsSync(avatarPath);

  if (hasAvatar) {
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

  return (
    <div
      className="rounded-full bg-accent-red flex items-center justify-center font-display text-white flex-shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
      aria-label="Matt, founder of PromoNight"
    >
      M
    </div>
  );
}
