# TODO: Avatar image

The indie developer block on the homepage and the `/about` page header both
show an avatar for Matt. When no image file exists, a brand-red circular
placeholder with initials "M" is rendered instead.

Drop a real photo in:

- `public/matt-avatar.jpg`

Recommended: square image, at least 128×128px, face-cropped.
`AvatarMatt` in `src/components/avatar-matt.tsx` auto-detects the file and
starts rendering it as soon as it exists.

When added, delete this file.
