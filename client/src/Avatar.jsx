/**
 * Profile avatar: cup (default), scroll, or custom upload.
 */
const PRESETS = {
  cup: '☕',
  scroll: '📜',
};

export function Avatar({ avatar, className = '', size = 36 }) {
  const isCustom = typeof avatar === 'string' && avatar.startsWith('data:image/');
  const preset = PRESETS[avatar] ?? PRESETS.cup;

  if (isCustom) {
    return (
      <img
        src={avatar}
        alt="Profile"
        className={`avatar avatar--img ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`avatar avatar--emoji ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.6 }}
      aria-hidden
    >
      {preset}
    </span>
  );
}
